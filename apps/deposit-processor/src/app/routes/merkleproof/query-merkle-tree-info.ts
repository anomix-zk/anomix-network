
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getLogger } from "@/lib/logUtils"

const logger = getLogger('queryMerkleTreeInfo');
/**
 * query MerkleTree Info
 */
export const queryMerkleTreeInfo: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/merkletree",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<{ treeId: number, includeUncommit: boolean }, null> = async function (
    req,
    res
): Promise<BaseResponse<{
    // flag: number, // TODO from 2023-10-21
    treeId: number,
    includeUncommit: boolean,
    depth: number,
    leafNum: string,
    treeRoot: string
}>> {
    const { treeId, includeUncommit } = req.body;

    const worldStateDBTmp = treeId == MerkleTreeId.DEPOSIT_TREE ? this.worldState.worldStateDB : this.worldState.worldStateDBLazy;

    // TODO As there is no MerkleTreeId.SYNC_DEPOSIT_TREE any more from 2023-10-21, Need to improve it here!TODO
    try {
        return {
            code: 0, data: {
                treeId,
                includeUncommit,
                depth: worldStateDBTmp.getDepth(MerkleTreeId.DEPOSIT_TREE),
                leafNum: worldStateDBTmp.getNumLeaves(MerkleTreeId.DEPOSIT_TREE, includeUncommit).toString(),
                treeRoot: worldStateDBTmp.getRoot(MerkleTreeId.DEPOSIT_TREE, includeUncommit).toString()
            }, msg: ''
        };
    } catch (err) {
        logger.error(err);
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query MerkleTree Info',
    tags: ['MerkleTree'],
    body: {
        type: 'object',
        properties: {
            treeId: {
                type: 'number',
                enum: [0, 6]
            },
            includeUncommit: {
                type: 'boolean',
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
                    properties: {
                        treeId: {
                            type: 'number',
                        },
                        includeUncommit: {
                            type: 'boolean',
                        },
                        depth: {
                            type: 'number'
                        },
                        leafNum: {
                            type: 'string',
                        },
                        treeRoot: {
                            type: 'string'
                        }
                    }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
