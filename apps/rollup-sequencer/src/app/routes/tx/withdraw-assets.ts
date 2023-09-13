
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { $axiosProofGenerator } from "@/lib";
import { checkAccountExists } from "@anomix/utils";
import { Block, WithdrawInfo } from "@anomix/dao";
import { WithdrawNoteWitnessData, LowLeafWitnessData, NullifierMerkleWitness } from "@anomix/circuits";
import { MerkleTreeId, BaseResponse, WithdrawNoteStatus, WithdrawAssetReqDto, WithdrawAssetReqDtoSchema, ProofTaskDto, ProofTaskType, BlockStatus } from "@anomix/types";
import {
    Field,
    PublicKey,
    VerificationKey
} from 'o1js';
import config from "@/lib/config";

/**
 * within WITHDRAWAL scene, server helps trigger the WithdrawContract with the noteCommitment from client.
 */
export const withdrawAsset: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx/withdraw",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

/**
 * during the entire WITHDRAWAL flow, need ganruantee being under the same data_tree root.
 */
async function checkPoint() {
    // query current latest block height
    const blockRepository = getConnection().getRepository(Block);
    // query latest block
    const blockEntity = (await blockRepository.find({
        select: [
            'id'
        ],
        where: {
            status: BlockStatus.CONFIRMED
        },
        order: {
            id: 'DESC'
        },
        take: 1
    }))[0];

    return blockEntity!.id;
}

export const handler: RequestHandler<WithdrawAssetReqDto, null> = async function (
    req,
    res
): Promise<BaseResponse<string>> {
    const { l1addr, noteCommitment } = req.body
    try {
        const connection = getConnection();
        const withdrawInfoRepository = connection.getRepository(WithdrawInfo);
        const winfo = (await withdrawInfoRepository.findOne({
            where: {
                outputNoteCommitment: noteCommitment,
                ownerPk: l1addr,
                status: WithdrawNoteStatus.PENDING
            }
        }))!

        // check if it's the first withdraw
        let tokenId = winfo.assetId;
        const { accountExists, account } = await checkAccountExists(PublicKey.fromBase58(l1addr), Field(tokenId));

        const notFirst = !accountExists && account.zkapp?.appState[0] == Field(0);

        if (notFirst) {//if it's NOT the first withdraw
            // loadTree from withdrawDB & obtain merkle witness
            await this.withdrawDB.loadTree(PublicKey.fromBase58(l1addr), winfo.assetId);

        } else {// first withdraw
            // init a 'USER_NULLIFIER_TREE' tree for it
            await this.withdrawDB.initTree(PublicKey.fromBase58(l1addr), winfo.assetId);
        }

        let initialCP = await checkPoint();// return the latest confirmed Block Height!

        const withdrawNote = winfo.valueNote();
        const index = winfo.outputNoteCommitmentIdx;
        const dataMerkleWitness = await this.worldState.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE,
            BigInt(winfo.outputNoteCommitmentIdx), false);

        const withdrawNoteWitnessData: WithdrawNoteWitnessData =
            WithdrawNoteWitnessData.fromJSON({
                withdrawNote,
                index,
                witness: dataMerkleWitness
            });

        const { index: preIdx, alreadyPresent } = await this.withdrawDB.findIndexOfPreviousValue(Field(winfo.outputNoteCommitment), true);
        const preLeafData = await this.withdrawDB.getLatestLeafDataCopy(preIdx, true);
        // alreadyPresent must be true at this stage
        const lowLeafWitness = LowLeafWitnessData.fromJSON({
            leafData: {
                value: preLeafData!.value.toString(),
                nextIndex: preLeafData!.nextIndex.toString(),
                nextValue: preLeafData!.nextValue.toString()
            },
            siblingPath: await this.withdrawDB.getSiblingPath(BigInt(preIdx), true),
            index: Field(preIdx).toString()
        });

        const oldNullWitness: NullifierMerkleWitness = await this.withdrawDB.getSiblingPath(this.withdrawDB.getNumLeaves(true), true)

        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<{ withdrawInfoId: number }, any> = {
            taskType: ProofTaskType.USER_FIRST_WITHDRAW,
            index: { withdrawInfoId: winfo.id },
            payload: {
                withdrawNoteWitnessData,
                lowLeafWitness,
                oldNullWitness
            }
        }

        if (!notFirst) {// first withdraw, need vk for deploy contract
            const verificationKey: VerificationKey = config.withdrawAccountVK;
            proofTaskDto.payload.verificationKey = verificationKey;
        } else {
            proofTaskDto.taskType = ProofTaskType.USER_WITHDRAW
        }

        // CHECKPOINT: check if this flow is outdated
        if (initialCP != await checkPoint()) {
            return {
                code: 1,
                data: 'failed: rollup begins!',
                msg: ''
            };
        }

        // send to proof-generator for circuit exec
        let rs = await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            return r.data;
        });
        if (rs.code == 1) {
            return {
                code: 1,
                data: 'failed: proof-generate error!',
                msg: ''
            };
        }

        // update status to 'PROCESSING' to avoid double computation triggered by user in a short time before the previous proof back.
        winfo!.status = WithdrawNoteStatus.PROCESSING;
        winfo.blockIdWhenL1Tx = initialCP;
        withdrawInfoRepository.save(winfo);

        return {
            code: 0,
            data: '',
            msg: 'processing'
        };

    } catch (err) {
        // roll back withdrawDB
        this.withdrawDB.rollback();

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    } finally {
        this.withdrawDB.reset();
    }
}

const schema = {
    description: 'query withdrawal notes by L1addr',
    tags: ["L2Tx"],
    body: {
        type: "object",
        properties: (WithdrawAssetReqDtoSchema as any).properties,
        required: ['l1addr', 'noteCommitment']
    },
    response: {
        200: {
            type: "object",
            properties: {
                code: {
                    type: 'number',
                    description: '0: success, 1: failure.'
                },
                data: {
                    type: 'string'
                },
                msg: {
                    type: 'string',
                    description: 'the reason or msg related to \'code\''
                }
            },
        }
    }
}

