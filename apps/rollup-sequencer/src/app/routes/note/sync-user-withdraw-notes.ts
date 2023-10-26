
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, MerkleTreeId, WithdrawEventFetchRecordStatus } from "@anomix/types";
import { getConnection, In } from "typeorm";
import { WithdrawEventFetchRecord, WithdrawInfo } from "@anomix/dao";
import { PublicKey, Field } from "o1js";
import { getLogger } from "@/lib/logUtils";


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
    logger.info(`a new round to sync withdrawed notes inside WithdrawEventFetchRecord...`);

    const connection = getConnection();

    const recordList = await connection.getRepository(WithdrawEventFetchRecord).find({
        where: {
            status: WithdrawEventFetchRecordStatus.NOT_SYNC
        }
    }) ?? [];

    if (recordList.length == 0) {
        logger.warn(`no new NOT_SYNC record, end.`);

        return { code: 0, data: 0, msg: '' }
    }

    logger.info(`NOT_SYNC recordList: ${JSON.stringify(recordList.map(r => r.id))}`);

    for (let i = 0; i < recordList.length; i++) {
        const record = recordList[i];
        logger.info(`start processing record[${record.id}...]`);

        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();
        try {
            const wIdList0: number[] = JSON.parse(record.data0);
            const withdrawNoteInfoList = await queryRunner.manager.find(WithdrawInfo, {
                where: {
                    id: In([wIdList0])
                }
            }) ?? [];

            const withdrawNoteInfoMap = new Map<string, WithdrawInfo[]>();
            withdrawNoteInfoList.forEach(w => {
                const wInfoList: WithdrawInfo[] = withdrawNoteInfoMap.get(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${w.assetId}:${w.ownerPk}`) ?? [];
                wInfoList.push(w);
                withdrawNoteInfoMap.set(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${w.assetId}:${w.ownerPk}`, wInfoList);
            });

            const wIdList_syncFailed: number[] = [];
            const wIdList_synced: number[] = [];
            for (let [key, wInfoListX] of withdrawNoteInfoMap) {
                const assetId = key.split(':')[1];
                const ownerPk = key.split(':')[2];

                const wInfo0 = wInfoListX[0];
                try {
                    logger.info(`loading tree: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${ownerPk} ...`);
                    // loadTree from withdrawDB & obtain merkle witness
                    await this.withdrawDB.loadTree(PublicKey.fromBase58(ownerPk), assetId);
                    logger.info(`load tree, done.`);

                    wInfoListX.sort((a, b) => {// from small to bigger
                        return Number(a.nullifierIdx) - Number(b.nullifierIdx)
                    });
                    logger.info(`need to sync withdrawNoteInfoList: ${JSON.stringify(wInfoListX.map(v => v.id))}`);

                    // check if the first nullifierTreeRoot0 is aligned
                    if (wInfo0.nullifierTreeRoot0 != this.withdrawDB.getRoot(false).toString()) {
                        console.error(`withdrawNoteInfo[${wInfo0.id}]'s nullifierTreeRoot0 != current root of ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${ownerPk}`);
                        logger.error(`withdrawNoteInfo[${wInfo0.id}]'s nullifierTreeRoot0 != current root of ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${ownerPk}`);

                        throw new Error(`root check failed!`);
                    }

                    // check the order before insert
                    wInfoListX.reduce((p, c) => {
                        if (wInfo0 == p) {
                            return wInfo0;
                        }
                        if (Number(p.nullifierIdx) + 1 != Number(c.nullifierIdx)) {
                            console.error(`withdrawNoteInfo[${c.id}]'s nullifierIdx[${c.nullifierIdx}] break the index order`);
                            logger.error(`withdrawNoteInfo[${c.id}]'s nullifierIdx[${c.nullifierIdx}] break the index order`);

                            throw new Error(`nullifierIdx break order!`);
                        }
                        return c;
                    }, wInfo0);

                    logger.info(`nullifierIdx from ${wInfo0.nullifierIdx} to ${wInfoListX[wInfoListX.length - 1].nullifierIdx}`);
                    const commitments = wInfoListX.map(v => {
                        return Field(v.outputNoteCommitment);
                    });
                    await this.withdrawDB.appendLeaves(commitments);

                    await this.withdrawDB.commit();
                    logger.info(`sync tree[${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${ownerPk}], done.`);

                    wIdList_synced.push(wInfo0.id);
                } catch (err) {
                    logger.error(err);

                    wIdList_syncFailed.push(wInfo0.id);
                } finally {
                    await this.withdrawDB.reset();//!!
                }
            }

            record.data0 = JSON.stringify(wIdList_syncFailed);
            logger.warn(`wIdList_syncFailed at record[id=${record.id}]: ${record.data0}`);
            record.data1 = JSON.stringify(wIdList_synced);
            logger.warn(`wIdList_synced at record[id=${record.id}]: ${record.data1}`);
            if (wIdList_syncFailed.length == 0) {
                record.status = WithdrawEventFetchRecordStatus.SYNCED;
                logger.warn(`update record[id=${record.id}]: SYNCED`);
            }
            await queryRunner.manager.save(record);

            await queryRunner.commitTransaction();
        } catch (err) {
            logger.error(err);
            console.error(err);

            await queryRunner.rollbackTransaction();

            return { code: 1, data: 0, msg: '' };
        } finally {
            await queryRunner.release();

            logger.info(`process record[${record.id}, done.]`);
        }
    }
    logger.info(`this round end.`);

    return { code: 0, data: 1, msg: '' };
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
