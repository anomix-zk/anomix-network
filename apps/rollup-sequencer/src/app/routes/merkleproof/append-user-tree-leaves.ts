
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getLogger } from "@/lib/logUtils"
import { PublicKey, Field } from "o1js";

const logger = getLogger('queryMerkleTreeInfo');

/**
 * append UserNullifierTree By Hand
 */
export const appendUserNullifierTreeByHand: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/user-nullifier-tree-append",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<{ passcode: string, timestamp: number, tokenId: string, ownerPk: string, leaves: string[] }, null> = async function (
    req,
    res
): Promise<BaseResponse<{
    treeId: string,
    depth: number,
    leafNum: string,
    treeRoot: string
}>> {
    const { passcode, timestamp, tokenId, ownerPk, leaves } = req.body;
    if (passcode != 'LzxWxs@2023') {
        return {
            code: 0,
            data: undefined as any,
            msg: 'passcode error!'
        }
    }

    if ((new Date().getTime() - timestamp) > 1 * 60 * 1000) {
        return {
            code: 0,
            data: undefined as any,
            msg: 'request out of date!'
        }
    }

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

        const includeUncommit = false;

        // print tree info
        logger.info(`print withdraw tree before append:`);
        logger.info(`  treeId: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk}`);
        logger.info(`  depth: ${this.withdrawDB.getDepth()}`);
        logger.info(`  leafNum: ${this.withdrawDB.getNumLeaves(includeUncommit).toString()}`);
        logger.info(`  treeRoot: ${this.withdrawDB.getRoot(includeUncommit).toString()}`);

        await this.withdrawDB.appendLeaves(leaves.map(l => Field(l)));
        await this.withdrawDB.commit();

        let depth = this.withdrawDB.getDepth();
        let leafNum = this.withdrawDB.getNumLeaves(includeUncommit).toString();
        let treeRoot = this.withdrawDB.getRoot(includeUncommit).toString();

        // print tree info
        logger.info(`print withdraw tree after append:`);
        logger.info(`  treeId: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk}`);
        logger.info(`  depth: ${this.withdrawDB.getDepth()}`);
        logger.info(`  leafNum: ${this.withdrawDB.getNumLeaves(includeUncommit).toString()}`);
        logger.info(`  treeRoot: ${this.withdrawDB.getRoot(includeUncommit).toString()}`);

        await this.withdrawDB.reset();

        return {
            code: 0,
            data: {
                treeId: `${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk}`,
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
    description: 'append User MerkleTree by Hand',
    tags: ['MerkleTree'],
    body: {
        type: 'object',
        properties: {
            passcode: {
                type: 'string',
            },
            timestamp: {
                type: 'number',
            },
            tokenId: {
                type: 'string',
            },
            ownerPk: {
                type: 'string',
            },
            leaves: {
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
                            type: 'string',
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
