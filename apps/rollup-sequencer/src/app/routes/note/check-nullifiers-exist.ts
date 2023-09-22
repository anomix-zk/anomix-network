
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, MerkleTreeId } from "@anomix/types";
/**
 * check if nullifiers exist
 */
export const checkNullifiersExist: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/existence/nullifiers",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<any>> {
    const nullifierList = req.body

    try {

        const rs = Object.fromEntries(
            await Promise.all(
                nullifierList.map(async n => {
                    return [n, String(await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${n}`) ?? '')]
                })
            )
        )

        return { code: 0, data: rs, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'check in batch existence of nullifier list including noteNullifier/aliasNullifier/acctViewPubKeyNullifier',
    tags: ['NOTE'],
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
                    additionalProperties: { type: "string" }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
