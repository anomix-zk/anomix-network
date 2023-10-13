
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { WorldStateRespDto, WorldStateRespDtoSchema, BaseResponse, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'

/**
 * query all trees' roots
 * @param instance 
 * @param options 
 * @param done 
 */
export const queryWorldStateworldState: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/network/worldstate",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<WorldStateRespDto>> {
    try {
        // query sequencer
        return {
            code: 0, data: {
                syncDataTree: {
                    totalNum: this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.SYNC_DATA_TREE, false).toString(),
                    root: this.worldState.worldStateDB.getRoot(MerkleTreeId.SYNC_DATA_TREE, false).toString()
                },
                dataTree: {
                    totalNum: this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, false).toString(),
                    root: this.worldState.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false).toString()
                },
                nullifierTree: {
                    totalNum: this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, false).toString(),
                    root: this.worldState.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, false).toString()
                },
                rootTree: {
                    totalNum: this.worldState.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, false).toString(),
                    root: this.worldState.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false).toString()
                },
            }, msg: ''
        };

    } catch (err) {
        console.error(err);
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query all trees roots',
    tags: ["Network"],
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: "object",
                    properties: (WorldStateRespDtoSchema as any).properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
