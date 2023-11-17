
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, MerkleProofDto, MerkleTreeId, WithdrawalWitnessDto, WithdrawalWitnessDtoSchema, WithdrawNoteStatus } from "@anomix/types";
import { getConnection } from "typeorm";
import { WithdrawInfo } from "@anomix/dao";
import { checkAccountExists } from "@anomix/utils";
import { PublicKey, Field } from "o1js";
import { getLogger } from "@/lib/logUtils";
import { LeafData } from "@anomix/merkle-tree";


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
            }
        })

        if (!winfo) {
            logger.warn(`no withdraw info, end.`);
            return { code: 1, data: undefined, msg: 'Cannot find the asset note!' } as BaseResponse<WithdrawalWitnessDto>;
        } else if (winfo.status == WithdrawNoteStatus.DONE) {
            return { code: 1, data: undefined, msg: 'This asset note has been claimed!' } as BaseResponse<WithdrawalWitnessDto>;
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
        const firstFlag = await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:STATUS:${ownerPk.toBase58()}:${tokenId}`);
        logger.info(`check if already init: firstFlag=${firstFlag?.toString()}`);
        if (!firstFlag) {
            logger.info(`it's the first withdraw, init tree...`);
            // init a 'USER_NULLIFIER_TREE' tree for it
            await this.withdrawDB.initTree(ownerPk, tokenId);
            await this.withdrawDB.commit();
            logger.info(`init tree, done.`);

            await this.worldState.indexDB.put(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:STATUS:${ownerPk.toBase58()}:${tokenId}`, '1');

        } else {
            logger.info(`it's NOT the first withdraw, load tree...`);
            // loadTree from withdrawDB & obtain merkle witness
            await this.withdrawDB.loadTree(ownerPk, tokenId);
            // await this.withdrawDB.commit();
            logger.info(`load tree, done.`);
        }

        // print tree info
        logger.info(`print withdraw tree info:`);
        logger.info(`  treeId: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk.toBase58()}`);
        logger.info(`  depth: ${this.withdrawDB.getDepth()}`);
        logger.info(`  leafNum: ${this.withdrawDB.getNumLeaves(false).toString()}`);
        logger.info(`  treeRoot: ${this.withdrawDB.getRoot(false).toString()}`);

        const outputNoteCommitmentIdx = winfo!.outputNoteCommitmentIdx ?? (await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${winfo.outputNoteCommitment}`));
        const targetIndx = this.withdrawDB.getNumLeaves(false);

        const rollupDataRoot = this.worldState.worldStateDBLazy.getRoot(MerkleTreeId.DATA_TREE, false).toString();
        logger.info(`current root of SYNC_DATA_TREE: ${rollupDataRoot}`);

        const lowLeafWitness = await this.withdrawDB.findPreviousValueAndMp(Field(winfo.outputNoteCommitment), true);
        const predecessorLeafData = lowLeafWitness.leafData;
        const predecessorIdx = lowLeafWitness.index;

        logger.info(`predecessor's index: ${predecessorIdx}`);
        logger.info(`predecessor: {value:${predecessorLeafData?.value}, nextValue:${predecessorLeafData?.nextValue}, nextIndex:${predecessorLeafData?.nextIndex}}`);

        logger.info(`before modify predecessor, nullifierTree Root: ${await this.withdrawDB.getRoot(true)}`);
        // logger.info(`before modify predecessor, nullifierTree Num: ${await this.withdrawDB.getNumLeaves(true)}`);
        const modifiedPredecessorLeafDataTmp: LeafData = {
            value: predecessorLeafData.value.toBigInt(),
            nextValue: Field(winfo.outputNoteCommitment).toBigInt(),
            nextIndex: targetIndx
        };
        await this.withdrawDB.updateLeaf(modifiedPredecessorLeafDataTmp, predecessorIdx.toBigInt());
        logger.info(`after modify predecessor, nullifierTree Root: ${await this.withdrawDB.getRoot(true)}`);
        // logger.info(`after modify predecessor, nullifierTree Num: ${await this.withdrawDB.getNumLeaves(true)}`);

        // obtain oldNullWitness
        const oldNullWitness = (await this.withdrawDB.getSiblingPath(BigInt(targetIndx), true))!.path.map(p => p.toString());
        logger.info('obtain oldNullWitness done.');

        const revertedPredecessorLeafDataTmp: LeafData = {
            value: predecessorLeafData.value.toBigInt(),
            nextValue: predecessorLeafData.nextValue.toBigInt(),
            nextIndex: predecessorLeafData.nextIndex.toBigInt()
        };
        await this.withdrawDB.updateLeaf(revertedPredecessorLeafDataTmp, predecessorIdx.toBigInt());
        logger.info(`after revert predecessor, nullifierTree Root: ${await this.withdrawDB.getRoot(true)}`);
        // logger.info(`after revert predecessor, nullifierTree Num: ${await this.withdrawDB.getNumLeaves(true)}`);

        const witnessOnSyncDataTree = (await this.worldState.worldStateDBLazy.getSiblingPath(MerkleTreeId.DATA_TREE, BigInt(outputNoteCommitmentIdx), false))!.path.map(p => p.toString());
        logger.info(`witnessOnSyncDataTree: ${JSON.stringify(witnessOnSyncDataTree)}`);

        const rs = {
            withdrawNoteWitnessData: {
                withdrawNote: winfo!.valueNote(),
                witness: witnessOnSyncDataTree,
                index: outputNoteCommitmentIdx
            },
            lowLeafWitness: {
                leafData: {
                    value: predecessorLeafData!.value.toString(),
                    nextIndex: predecessorLeafData!.nextIndex.toString(),
                    nextValue: predecessorLeafData!.nextValue.toString()
                },
                siblingPath: lowLeafWitness.siblingPath.path.map(p => p.toString()),
                index: Field(predecessorIdx).toString()
            },
            oldNullWitness,
            rollupDataRoot
        }

        await this.withdrawDB.reset();

        return { code: 0, data: rs, msg: '' };
    } catch (err) {
        logger.error(err);
        console.error(err);
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
