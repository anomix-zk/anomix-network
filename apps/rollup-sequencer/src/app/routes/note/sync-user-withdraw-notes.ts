
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, MerkleProofDto, MerkleTreeId, WithdrawalWitnessDto, WithdrawalWitnessDtoSchema, WithdrawEventFetchRecordStatus, WithdrawNoteStatus } from "@anomix/types";
import { getConnection, In } from "typeorm";
import { WithdrawEventFetchRecord, WithdrawInfo } from "@anomix/dao";
import { checkAccountExists } from "@anomix/utils";
import { PublicKey, Field } from "o1js";
import { getLogger } from "@/lib/logUtils";
import { LeafData } from "@anomix/merkle-tree";


const logger = getLogger('syncUserWithdrawedNotes');
/**
 * sync User Withdrawed Notes
 */
export const syncUserWithdrawedNotes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/note/withdrawal-batch-sync",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<number>> {
    logger.info(`sync withdrawed notes inside WithdrawEventFetchRecord...`);

    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.startTransaction();
    try {
        const recordList = await queryRunner.manager.find(WithdrawEventFetchRecord, {
            where: {
                status: WithdrawEventFetchRecordStatus.NOT_SYNC
            }
        }) ?? [];

        if (recordList.length == 0) {
            logger.warn(`no new NOT_SYNC record, end.`);

            return { code: 0, data: 0, msg: '' }
        }

        logger.info(`NOT_SYNC recordList: ${JSON.stringify(recordList)}`);

        const wIdList: number[] = [];
        recordList.forEach(r => {
            wIdList.push(...JSON.parse(r.data));
        });

        const withdrawNoteInfoList = await queryRunner.manager.find(WithdrawInfo, {
            where: {
                id: In([wIdList])
            }
        }) ?? [];

        const withdrawNoteInfoMap = new Map<string, WithdrawInfo[]>();
        withdrawNoteInfoList.forEach(w => {
            const wInfoList: WithdrawInfo[] = withdrawNoteInfoMap.get(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${w.assetId}:${w.ownerPk}`) ?? [];
            wInfoList.push(w);
            withdrawNoteInfoMap.set(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${w.assetId}:${w.ownerPk}`, wInfoList);
        });

        for (let [key, value] of withdrawNoteInfoMap) {
            const assetId = key.split(':')[1];
            const ownerPk = key.split(':')[2];

            logger.info(`loading tree: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${ownerPk} ...`);
            // loadTree from withdrawDB & obtain merkle witness
            await this.withdrawDB.loadTree(PublicKey.fromBase58(ownerPk), assetId);
            logger.info(`load tree, done.`);

            value.sort((a, b) => {// from small to bigger
                return Number(a.nullifierIdx) - Number(b.nullifierIdx)
            });
            logger.info(`need to sync withdrawNoteInfoList: ${JSON.stringify(value.map(v => v.id))}`);
            logger.info(`nullifierIdx from ${value[0].nullifierIdx} to ${value[value.length - 1].nullifierIdx}`);

            const commitments = value.map(v => {
                return Field(v.outputNoteCommitment);
            });

            await this.withdrawDB.appendLeaves(commitments);

            await this.withdrawDB.commit();
            logger.info(`sync tree[${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${ownerPk}], done.`);

            await this.withdrawDB.reset();//!!
        }

        return { code: 0, data: 1, msg: '' };
    } catch (err) {
        logger.error(err);
        console.error(err);
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'sync Withdrawed Notes',
    tags: ['NOTE'],
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'number'
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
