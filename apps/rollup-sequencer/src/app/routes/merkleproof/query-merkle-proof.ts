
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, MerkleProofDto, MerkleProofDtoSchema, MerkleTreeId } from '@anomix/types'
import { RequestHandler } from '@/lib/types'


/**
 * obtain existence-proof on data_tree/sync_data_tree for note_commitment, <br>
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

export const handler: RequestHandler<{ treeId: number, commitmentList: string[] }, null> = async function (
    req,
    res
): Promise<BaseResponse<MerkleProofDto[]>> {
    const { treeId, commitmentList } = req.body

    try {
        const merkleProofDtoList: any[] = [];

        for (let i = 0; i < commitmentList.length; i++) {
            const commitment = commitmentList[i];

            // DATA_TREE:{comitment} -> leafIndex
            let leafIndex = String(await this.worldState.indexDB.get(`${MerkleTreeId[treeId]}:${commitment}`) ?? '');

            if (leafIndex) {
                const siblingPath = await this.worldState.worldStateDB.getSiblingPath(treeId, BigInt(leafIndex), false);

                merkleProofDtoList.push({
                    leafIndex: Number(leafIndex),
                    commitment: commitment,
                    paths: siblingPath.path.map(p => { return p.toString(); })
                } as MerkleProofDto
                );
            }
        }

        return { code: 0, data: merkleProofDtoList, msg: '' };
    } catch (err) {
        console.error(err);

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query MerkleWitness on data_tree/sync_data_tree by valueNote/accountNote commitment',
    tags: ['MerkleWitness'],
    body: {
        type: 'object',
        properties: {
            treeId: {
                type: 'number',
                enum: [1, 2]
            },
            commitmentList: {
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
