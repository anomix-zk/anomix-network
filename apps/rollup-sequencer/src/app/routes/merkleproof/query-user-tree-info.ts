
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getLogger } from "@/lib/logUtils"
import { PublicKey, Field } from "o1js";

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
        const firstFlag = await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:STATUS:${ownerPk}:${tokenId}`);
        logger.info(`check if already init: firstFlag=${firstFlag?.toString()}`);
        if (!firstFlag) {
            return {
                code: 0,
                data: undefined as any,
                msg: 'the tree is not init yet!'
            }
        }

        logger.info(`loading tree: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk} ...`);
        // loadTree from withdrawDB & obtain merkle witness
        await this.withdrawDB.loadTree(PublicKey.fromBase58(ownerPk), tokenId);
        logger.info(`load tree, done.`);

        const depth = this.withdrawDB.getDepth();
        const leafNum = this.withdrawDB.getNumLeaves(includeUncommit).toString();
        const treeRoot = this.withdrawDB.getRoot(includeUncommit).toString();
        await this.withdrawDB.reset();
        logger.info(`withdrawDB.reset... done.`);

        return {
            code: 0,
            data: {
                treeId: `${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk}`,
                includeUncommit,
                depth,
                leafNum,
                treeRoot
            }, msg: ''
        };
    } catch (err) {
        logger.error(err);
        console.error(err);
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
