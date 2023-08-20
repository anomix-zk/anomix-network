
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, MerkleProofDto, MerkleProofDtoSchema } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { $axiosSeq } from "@/lib/api"


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
    const commitmentList = req.body

    try {
        // request sequencer for the result.
        const rs = await $axiosSeq.post<BaseResponse<MerkleProofDto[]>>('/merklewitness', commitmentList).then(r => {
            return r.data
        })

        return rs;
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query MerkleWitness by valueNote/accountNote commitment',
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
                    type: "array",
                    items: {
                        type: (MerkleProofDtoSchema as any).type,
                        properties: (MerkleProofDtoSchema as any).properties,
                    }
                },

                msg: {
                    type: 'string'
                }
            }
        }
    }
}
