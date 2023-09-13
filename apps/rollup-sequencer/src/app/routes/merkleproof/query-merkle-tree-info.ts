
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse } from '@anomix/types'
import { RequestHandler } from '@/lib/types'


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
    treeId: number,
    includeUncommit: boolean,
    depth: number,
    leafNum: string,
    treeRoot: string
}>> {
    const { treeId, includeUncommit } = req.body;

    try {
        return {
            code: 0, data: {
                treeId,
                includeUncommit,
                depth: this.worldState.worldStateDB.getDepth(treeId),
                leafNum: this.worldState.worldStateDB.getNumLeaves(treeId, includeUncommit).toString(),
                treeRoot: this.worldState.worldStateDB.getRoot(treeId, includeUncommit).toString()
            }, msg: ''
        };
    } catch (err) {
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
                enum: [1, 2, 3, 4]
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
