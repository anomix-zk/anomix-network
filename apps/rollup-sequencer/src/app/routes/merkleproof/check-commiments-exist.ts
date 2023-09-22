
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, MerkleTreeId } from "@anomix/types";

/**
 * check if commitments exist
 */
export const checkCommitmentsExist: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/existence/commitments",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<any>> {
    const commitmentList = req.body

    try {
        const rs = Object.fromEntries(
            await Promise.all(commitmentList.map(async c => {
                return [c, String(await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${c}`) ?? '')];
            }))
        )

        return { code: 0, data: rs, msg: '' };
    } catch (err) {
        console.error(err);
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'check in batch existence of each note commitment',
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
                    type: 'any',
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
