
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getLogger } from "@/lib/logUtils"
import { PublicKey, Field } from "o1js";

const logger = getLogger('queryMerkleTreeInfo');

/**
 * append Tree By Hand
 */
export const appendTreeByHand: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tree-append",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<{ passcode: string, timestamp: number, treeId: number, leaves: string[] }, null> = async function (
    req,
    res
): Promise<BaseResponse<{
    treeId: number,
    treeName: string,
    depth: number,
    leafNum: string,
    treeRoot: string
}>> {
    const { passcode, timestamp, treeId, leaves } = req.body;
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

    const treeName = MerkleTreeId[treeId];

    try {
        const includeUncommit = false;

        // print tree info
        logger.info(`print tree before append:`);
        logger.info(`  treeId: ${treeId}`);
        logger.info(`  treeName: ${treeName}`);
        logger.info(`  depth: ${this.worldState.worldStateDB.getDepth(treeId)}`);
        logger.info(`  leafNum: ${this.worldState.worldStateDB.getNumLeaves(treeId, includeUncommit).toString()}`);
        logger.info(`  treeRoot: ${this.worldState.worldStateDB.getRoot(treeId, includeUncommit).toString()}`);

        await this.worldState.worldStateDB.appendLeaves(treeId, leaves.map(l => Field(l)));
        await this.worldState.worldStateDB.commit();

        let depth = this.worldState.worldStateDB.getDepth(treeId);
        let leafNum = this.worldState.worldStateDB.getNumLeaves(treeId, includeUncommit).toString();
        let treeRoot = this.worldState.worldStateDB.getRoot(treeId, includeUncommit).toString();

        // print tree info
        logger.info(`print tree after append:`);
        logger.info(`  treeId: ${treeId}`);
        logger.info(`  treeName: ${treeName}`);
        logger.info(`  depth: ${depth}`);
        logger.info(`  leafNum: ${leafNum}`);
        logger.info(`  treeRoot: ${treeRoot}`);

        return {
            code: 0,
            data: {
                treeId,
                treeName,
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
    description: 'append Specified MerkleTree by Hand',
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
            treeId: {
                type: 'number',
                description:
                    `DEPOSIT_TREE = 0, 
                    DATA_TREE = 1, 
                    SYNC_DATA_TREE = 2, 
                    NULLIFIER_TREE = 3, 
                    DATA_TREE_ROOTS_TREE = 4, 
                    USER_NULLIFIER_TREE = 5, 
                    SYNC_DEPOSIT_TREE = 6 
                    `
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
                            type: 'number',
                        },
                        treeName: {
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
