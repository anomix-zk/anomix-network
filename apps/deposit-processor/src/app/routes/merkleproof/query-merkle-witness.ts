
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'


/**
 * query MerkleWitness
 */
export const queryMerkleWitness: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/merkle-witness",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<{ treeId: number, leafIndexList: string[] }, null> = async function (
    req,
    res
): Promise<BaseResponse<{
    treeId: number,
    treeRoot: string,
    witnesses: any[][]
}>> {
    const { treeId, leafIndexList } = req.body;

    try {
        const treeRoot = this.worldState.worldStateDB.getRoot(treeId, false).toString();
        const witnesses: any[][] = [];

        for (const leafIndex of leafIndexList) {
            witnesses.push([leafIndex, await this.worldState.worldStateDB.getSiblingPath(treeId, BigInt(leafIndex), false)]);
        }

        return {
            code: 0, data: {
                treeId,
                treeRoot,
                witnesses
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
                enum: [0, 6]
            },
            leafIndexList: {
                type: 'array',
                items: {
                    type: 'string'
                }
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
                        treeRoot: {
                            type: 'string'
                        },
                        witnesses: {
                            type: 'array',
                            items: {
                                type: 'array',
                            }
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
