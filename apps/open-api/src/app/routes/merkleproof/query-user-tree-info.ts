
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getLogger } from "@/lib/logUtils"
import { PublicKey, Field } from "o1js";
import { $axiosSeq } from "@/lib/api"

const logger = getLogger('queryMerkleTreeInfo');

/**
 * query user MerkleTree Info
 */
export const queryUserTreeInfo: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/user-nullifier-tree",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<{ tokenId: string, ownerPk: string, includeUncommit: boolean }, null> = async function (
    req,
    res
): Promise<BaseResponse<{
    treeId: string,
    includeUncommit: boolean,
    depth: number,
    leafNum: string,
    treeRoot: string
}>> {
    const { tokenId, ownerPk, includeUncommit } = req.body;
    try {
        const rs = await $axiosSeq.post<BaseResponse<{
            treeId: string,
            includeUncommit: boolean,
            depth: number,
            leafNum: string,
            treeRoot: string
        }>>('/user-nullifier-tree', { tokenId, ownerPk, includeUncommit }).then(r => {
            return r.data
        })
        return rs;
    } catch (err) {
        console.error(err);
        logger.error(err);

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query user MerkleTree Info',
    tags: ['MerkleTree'],
    body: {
        type: 'object',
        properties: {
            tokenId: {
                type: 'string',
            },
            ownerPk: {
                type: 'string',
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
                            type: 'string',
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
