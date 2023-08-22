
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, FlowTask, FlowTaskType, MerkleTreeId, ProofTaskDto, ProofTaskType } from "@anomix/types";
import { type } from "os";
import { getConnection } from "typeorm";
import { DepositProverOutput } from "@anomix/dao";

/**
 * trigger rollup contract call
 */
export const triggerContractCall: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/rollup/contract-call/:transId",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, { transId: number }> = async function (
    req,
    res
): Promise<BaseResponse<any>> {
    try {
        const transId = req.params.transId;

        const outputRepo = getConnection().getRepository(DepositProverOutput);
        const op = await outputRepo.findOne({ where: { transId } });
        const proofTaskDto = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: undefined,
            payload: {
                flowId: undefined as any,
                taskType: FlowTaskType.DEPOSIT_UPDATESTATE,
                data: op!.output
            } as FlowTask<any>
        } as ProofTaskDto<any, FlowTask<any>>;

        await this.worldState.processProofResult(proofTaskDto);

        return {
            code: 0, data: '', msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'trigger rollup contract call',
    tags: ['Rollup'],
    params: {
        type: "object",
        properties: {
            'transId': {
                type: "number",
            }
        },
        required: ['transId']
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'number'
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
