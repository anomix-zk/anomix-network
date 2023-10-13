
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, MerkleProofDto, MerkleProofDtoSchema } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { $axiosSeq } from "@/lib/api"
import { getLogger } from "@/lib/logUtils"

const logger = getLogger('queryMerkleProof');

/**
 * obtain existence-proof on data_tree for note_commitment, <br>
 */
export const queryMerkleProof: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/merklewitness",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<MerkleProofDto[]>> {
    try {
        // request sequencer for the result.
        const rs = await $axiosSeq.post<BaseResponse<MerkleProofDto[]>>('/merklewitness', { treeId: 1, commitmentList: req.body }).then(r => {
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
    description: 'query MerkleWitness on data_tree/sync_data_tree by valueNote/accountNote commitment',
    tags: ['MerkleWitness'],
    body: {
        type: 'array',
        items: {
            type: 'string'
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
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: MerkleProofDtoSchema.properties
                    }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
