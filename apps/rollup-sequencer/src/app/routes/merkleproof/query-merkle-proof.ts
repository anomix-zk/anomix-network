
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, MerkleProofDto, MerkleProofDtoSchema, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'


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
        const merkleProofDtoList = await Promise.all(commitmentList.map(async c => {
            // DATA_TREE:{comitment} -> leafIndex
            let leafIndex = await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${c}`);

            const siblingPath = await this.worldState.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, BigInt(leafIndex), false);
            return {
                leafIndex,
                commitment: c,
                paths: siblingPath.path.map(p => { return p.toString(); })
            } as MerkleProofDto;
        }));

        return { code: 0, data: merkleProofDtoList, msg: '' };
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
                    type: 'object',
                    properties: MerkleProofDtoSchema.properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
