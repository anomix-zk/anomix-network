
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, WithdrawalWitnessDto, WithdrawalWitnessDtoSchema } from "@anomix/types";
import { $axiosOpenApi } from "@/lib/api";
import { RequestHandler } from "@/lib/types";
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('queryWitnessByWithdrawNotes');

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

const handler: RequestHandler<null, { commitment: string }> = async function (
    req,
    res
): Promise<BaseResponse<WithdrawalWitnessDto>> {
    const withdrawCommitment = req.params.commitment;

    try {
        const rs = await $axiosOpenApi.get<BaseResponse<WithdrawalWitnessDto>>('/merklewitness/withdraw-commitment/'.concat(withdrawCommitment)).then(r => {
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
    description: 'query all Witness By WithdrawNote commitment',
    tags: ['MerkleWitness'],
    params: {
        type: "object",
        properties: {
            commitment: {
                type: "string",
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
                    type: WithdrawalWitnessDtoSchema.type,
                    properties: WithdrawalWitnessDtoSchema.properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
