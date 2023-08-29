
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, WithdrawalWitnessDto, WithdrawalWitnessDtoSchema } from "@anomix/types";
import { $axiosSeq } from "@/lib/api";
import { RequestHandler } from "@/lib/types";

/**
 * query all Witness By WithdrawNotes
 */
export const queryWitnessByWithdrawNotes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/merklewitness/withdraw-commitment/:commitment",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

const handler: RequestHandler<null, string> = async function (
    req,
    res
): Promise<BaseResponse<WithdrawalWitnessDto>> {
    const withdrawCommitment = req.params;

    try {
        const rs = await $axiosSeq.get<BaseResponse<WithdrawalWitnessDto>>('/merklewitness/withdraw-commitment/'.concat(withdrawCommitment)).then(r => {
            return r.data
        })
        return rs;
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query all Witness By WithdrawNotes',
    tags: ['NOTE'],
    params: {
        type: 'string'
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
                    properties: WithdrawalWitnessDtoSchema.properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
