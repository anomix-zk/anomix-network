
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, MerkleProofDto, MerkleTreeId, WithdrawalWitnessDto, WithdrawalWitnessDtoSchema, WithdrawNoteStatus } from "@anomix/types";
import { getConnection } from "typeorm";
import { WithdrawInfo } from "@anomix/dao";
import { checkAccountExists } from "@anomix/utils";
import { PublicKey, Field } from "o1js";
import { getLogger } from "@/lib/logUtils";


const logger = getLogger('queryWitnessByWithdrawNotes');
/**
 * query all Witness By WithdrawNotes
 */
export const queryWitnessByWithdrawNotes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/merklewitness/withdraw-commitment/:commitment",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

const handler: RequestHandler<null, { commitment: string }> = async function (
    req,
    res
): Promise<BaseResponse<WithdrawalWitnessDto>> {
    const withdrawCommitment = req.params.commitment;
    logger.info(`a new witness query begin, target withdrawCommitment: ${withdrawCommitment}`);

    try {
        const connection = getConnection();
        const withdrawInfoRepo = connection.getRepository(WithdrawInfo);
        const winfo = await withdrawInfoRepo.findOne({
            where: {
                outputNoteCommitment: withdrawCommitment,
                status: WithdrawNoteStatus.PENDING
            }
        })

        if (!winfo) {
            logger.warn(`no withdraw info, end.`);
            return { code: 1, data: undefined, msg: 'cannot find the value note!' } as BaseResponse<WithdrawalWitnessDto>;
        }

        // check if it's the first withdraw
        let tokenId = winfo.assetId;
        const ownerPk = PublicKey.fromBase58(winfo.ownerPk);

        /*
        const { accountExists, account } = await checkAccountExists(ownerPk, Field(tokenId));
        const notFirst = !accountExists && account.zkapp?.appState[0] == Field(0);

        if (notFirst) {//if it's NOT the first withdraw
            logger.info(`it's NOT the first withdraw, load tree...`);
            // loadTree from withdrawDB & obtain merkle witness
            await this.withdrawDB.loadTree(ownerPk, tokenId);
            await this.withdrawDB.commit();
            logger.info(`load tree, done.`);

        } else {// first withdraw, should deploy first
            logger.info(`it's the first withdraw, init tree...`);
            // TODO check if already init
            if ((await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:STATUS:${ownerPk.toBase58}:${tokenId}`)) != '1') {
                // init a 'USER_NULLIFIER_TREE' tree for it
                await this.withdrawDB.initTree(ownerPk, tokenId);
                await this.withdrawDB.commit();
                await this.worldState.indexDB.put(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:STATUS:${ownerPk.toBase58}:${tokenId}`, '1');
            }

            logger.info(`init tree, done.`);

            return { code: 1, data: undefined, msg: 'please deploy WithdrawAccount first!' } as BaseResponse<WithdrawalWitnessDto>;
        }
        */

        // check if already init
        if ((await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:STATUS:${ownerPk.toBase58}:${tokenId}`)) != '1') {
            logger.info(`it's the first withdraw, init tree...`);
            // init a 'USER_NULLIFIER_TREE' tree for it
            await this.withdrawDB.initTree(ownerPk, tokenId);
            await this.withdrawDB.commit();
            logger.info(`init tree, done.`);

            await this.worldState.indexDB.put(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:STATUS:${ownerPk.toBase58}:${tokenId}`, '1');

        } else {
            logger.info(`it's NOT the first withdraw, load tree...`);
            // loadTree from withdrawDB & obtain merkle witness
            await this.withdrawDB.loadTree(ownerPk, tokenId);
            await this.withdrawDB.commit();
            logger.info(`load tree, done.`);
        }

        const { index: preIdx, alreadyPresent } = await this.withdrawDB.findIndexOfPreviousValue(Field(winfo.outputNoteCommitment), true);
        logger.info(`predecessor's index: ${preIdx}`);

        const preLeafData = await this.withdrawDB.getLatestLeafDataCopy(preIdx, true);
        logger.info(`predecessor: ${JSON.stringify(preLeafData)}`);

        const rollupDataRoot = this.worldState.worldStateDB.getRoot(MerkleTreeId.SYNC_DATA_TREE, false).toString();
        logger.info(`current root of SYNC_DATA_TREE: ${rollupDataRoot}`);

        const outputNoteCommitmentIdx = winfo!.outputNoteCommitmentIdx ?? (await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${winfo.outputNoteCommitment}`));

        const rs = {
            withdrawNoteWitnessData: {
                withdrawNote: winfo!.valueNote(),
                witness: (await this.worldState.worldStateDB.getSiblingPath(MerkleTreeId.SYNC_DATA_TREE, BigInt(outputNoteCommitmentIdx), false))!.path.map(p => p.toString()),
                index: outputNoteCommitmentIdx
            },
            lowLeafWitness: {
                leafData: {
                    value: preLeafData!.value.toString(),
                    nextIndex: preLeafData!.nextIndex.toString(),
                    nextValue: preLeafData!.nextValue.toString()
                },
                siblingPath: (await this.worldState.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, BigInt(outputNoteCommitmentIdx), false))!.path.map(p => p.toString()),
                index: Field(preIdx).toString()
            },
            oldNullWitness: (await this.worldState.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, BigInt(outputNoteCommitmentIdx), false))!.path.map(p => p.toString()),
            rollupDataRoot
        }

        await this.withdrawDB.reset();

        return { code: 0, data: rs, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query all Witness By WithdrawNotes',
    tags: ['NOTE'],
    params: {
        type: "object",
        properties: {
            commitment: {
                type: "string",
            }
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'object',
                    properties: WithdrawalWitnessDtoSchema.properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
