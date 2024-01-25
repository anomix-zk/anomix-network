import { BaseResponse, BlockStatus, MerkleTreeId, ProofTaskDto, ProofTaskType, ProofVerifyReqDto, ProofVerifyReqType, RollupTaskDto, WithdrawAssetReqDto, WithdrawEventFetchRecordStatus, WithdrawNoteStatus } from "@anomix/types";
import process from "process";
import { $axiosProofGenerator, $axiosProofGeneratorProofVerify0, $axiosProofGeneratorProofVerify1 } from "@/lib";
import { DATA_TREE_HEIGHT, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, NULLIFIER_TREE_HEIGHT, ROOT_TREE_HEIGHT, WithdrawNoteWitnessData } from "@anomix/circuits";
import { getLogger } from "@/lib/logUtils";
import config from "@/lib/config";
import { verify } from "o1js";
import { Block, L2Tx, MemPlL2Tx, WithdrawEventFetchRecord, WithdrawInfo } from '@anomix/dao';
import { getConnection, In } from "typeorm";
import { checkAccountExists } from "@anomix/utils";
import {
    Field,
    PublicKey,
    VerificationKey
} from 'o1js';
import { StandardIndexedTree } from "@anomix/merkle-tree";
import { WorldState } from "@/worldstate";
import { WithdrawDB } from "@/worldstate/withdraw-db";

const logger = getLogger('rollupSeqHandler');

export const queryTxByNullifierEndpoint = async (dto: string[]) => {
    const notehashes = dto;

    const connection = getConnection();

    try {
        // query confirmed tx
        const txRepository = connection.getRepository(L2Tx);
        let l2TxListNullifier1 = await txRepository.find({
            where: {
                nullifier1: In(notehashes)
            }
        }) ?? [];

        let l2TxListNullifier2 = await txRepository.find({
            where: {
                nullifier2: In(notehashes)
            }
        }) ?? [];

        let l2TxList = l2TxListNullifier1.concat(l2TxListNullifier2);
        const map = new Map();
        l2TxList.forEach(e => {
            map.set(e.txHash, e);
        });

        const result = Array.from(map.values());

        return {
            code: 0,
            data: result,
            msg: ''
        };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}


export const withdrawAssetEndpoint = async (worldState: WorldState, withdrawDB: WithdrawDB, dto: WithdrawAssetReqDto) => {
    const { l1addr, noteCommitment } = dto
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
            await withdrawDB.loadTree(PublicKey.fromBase58(l1addr), winfo.assetId);

        } else {// first withdraw
            // init a 'USER_NULLIFIER_TREE' tree for it
            await withdrawDB.initTree(PublicKey.fromBase58(l1addr), winfo.assetId);
        }

        let initialCP = await checkPoint();// return the latest confirmed Block Height!

        const withdrawNote = winfo.valueNote();
        const index = winfo.outputNoteCommitmentIdx;
        const dataMerkleWitness = await worldState.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE,
            BigInt(winfo.outputNoteCommitmentIdx), false);

        const withdrawNoteWitnessData: WithdrawNoteWitnessData =
            WithdrawNoteWitnessData.fromJSON({
                withdrawNote,
                index,
                witness: dataMerkleWitness
            });

        const { index: preIdx, alreadyPresent } = await withdrawDB.findIndexOfPreviousValue(Field(winfo.outputNoteCommitment), true);
        const preLeafData = await withdrawDB.getLatestLeafDataCopy(preIdx, true);
        // alreadyPresent must be true at this stage
        const lowLeafWitness = LowLeafWitnessData.fromJSON({
            leafData: {
                value: preLeafData!.value.toString(),
                nextIndex: preLeafData!.nextIndex.toString(),
                nextValue: preLeafData!.nextValue.toString()
            },
            siblingPath: await withdrawDB.getSiblingPath(BigInt(preIdx), true),
            index: Field(preIdx).toString()
        });

        const oldNullWitness: NullifierMerkleWitness = await withdrawDB.getSiblingPath(withdrawDB.getNumLeaves(true), true)

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
            //const verificationKey: VerificationKey = config.withdrawAccountVK;
            //proofTaskDto.payload.verificationKey = verificationKey;
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
        withdrawDB.rollback();

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    } finally {
        withdrawDB.reset();
    }
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

async function proofCallback(worldState: WorldState, withdrawDB: WithdrawDB, dto: ProofTaskDto<any, any>) {

    const { taskType, index, payload } = dto

    if (taskType == ProofTaskType.ROLLUP_FLOW) {

        process.send!(dto);

    } else {// FIRST_WITHDRAW || WITHDRAW
        const connection = getConnection();
        const withdrawInfoRepository = connection.getRepository(WithdrawInfo)
        try {
            const withdrawInfo = (await withdrawInfoRepository.findOne({
                where: {
                    id: index.withdrawInfoId
                }
            }))!;

            // query current latest block height
            const blockRepository = connection.getRepository(Block);
            // query latest block
            const blockEntity = (await blockRepository.find({
                select: [
                    'id'
                ],
                order: {
                    id: 'DESC'
                },
                take: 1
            }))[0];
            const currentBlockHeight = blockEntity.id;

            if (withdrawInfo.blockIdWhenL1Tx != currentBlockHeight) {// outdated, should revert status!
                withdrawInfo.status = WithdrawNoteStatus.PENDING;

                // loadTree from withdrawDB & obtain merkle witness
                await withdrawDB.loadTree(PublicKey.fromBase58(withdrawInfo.ownerPk), withdrawInfo.assetId);// the tree must be in cache now!
                await withdrawDB.rollback();// rollup it!
                withdrawDB.reset();// the total flow is ended.
            } else {
                withdrawInfo.l1TxBody = JSON.stringify(payload);
                // withdrawInfo?.l1TxHash = payload.   // TODO how to pre_calc tx.id??
            }

            // save l1TxBody
            await withdrawInfoRepository.save(withdrawInfo);

        } catch (err) {
            // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
        }
    }

    return {
        code: 0,
        data: '',
        msg: 'in queue'
    };
}



async function rollupProofTrigger(dto: RollupTaskDto<any, any>) {
    try {
        // forward it to main process, and will further forward it to Rollup processes.
        process.send!(dto)

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

async function triggerStartNewFlow(worldState: WorldState) {
    try {
        // start a new flow! 
        await worldState.startNewFlow();

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

async function checkCommitmentsExist(worldState: WorldState, commitmentList: string[]) {
    try {
        const rs = Object.fromEntries(
            await Promise.all(commitmentList.map(async c => {
                return [c, String(await worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${c}`) ?? '')];
            }))
        )

        return { code: 0, data: rs, msg: '' };
    } catch (err) {
        console.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

