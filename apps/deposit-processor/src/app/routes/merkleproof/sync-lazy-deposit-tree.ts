
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, BlockCacheType, MerkleTreeId, DepositTransCacheType } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getConnection } from "typeorm"
import { Block, BlockCache, DepositTreeTrans, DepositTreeTransCache } from "@anomix/dao"
import { Field } from "o1js";
import { getLogger } from "@/lib/logUtils"

const logger = getLogger('syncLazyDepositTree');

/**
 * query MerkleTree Info
 */
export const syncLazyDepositTree: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/merkletree/sync/:transId",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, { transId: number }> = async function (
    req,
    res
): Promise<BaseResponse<string>> {
    const transId = req.params.transId;

    try {

        const dcTranRepo = getConnection().getRepository(DepositTreeTrans);
        const dcTrans = (await dcTranRepo.findOne({ where: { id: transId } }));

        if (!dcTrans) {
            return {
                code: 1, data: '', msg: 'non-exiting transId'
            };
        }

        // check if sync_date_tree root is aligned with 
        // check if duplicated call
        const treeLeafNum = this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.SYNC_DEPOSIT_TREE, false);
        if (dcTrans.startActionIndex == treeLeafNum.toString()) {
            const dcTransCacheRepo = getConnection().getRepository(DepositTreeTransCache);
            const cachedStr = (await dcTransCacheRepo.findOne({ where: { dcTransId: transId, type: DepositTransCacheType.DEPOSIT_TREE_UPDATES } }))!.cache;

            const dcTransCachedUpdates1 = (JSON.parse(cachedStr) as Array<string>).map(i => Field(i));
            await this.worldState.worldStateDB.appendLeaves(MerkleTreeId.SYNC_DEPOSIT_TREE, dcTransCachedUpdates1);

            await this.worldState.worldStateDB.commit(); // here only 'SYNC_DEPOSIT_TREE' commits underlyingly           

            return {
                code: 0, data: '', msg: ''
            };
        } else {
            return {
                code: 1, data: '', msg: 'rejected duplicated call!'
            };
        }

    } catch (err) {
        logger.error(err);
        console.error(err);

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query MerkleTree Info',
    tags: ['MerkleTree'],
    params: {
        type: "object",
        properties: {
            transId: {
                type: "number",
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
                    type: 'string'
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
