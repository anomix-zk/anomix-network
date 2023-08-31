
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, ProofTaskDto, ProofTaskDtoSchma } from "@anomix/types";
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('deposit-processor-main-server');
/**
* recieve proof result from proof-generator
*/
export const proofCallback: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/proof-result",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

const handler: RequestHandler<ProofTaskDto<any, any>, null> = async function (
    req,
    res
): Promise<BaseResponse<string>> {
    try {

        await this.worldState.processProofResult(req.body);

    } catch (error) {
        return {
            code: 1,
            data: '',
            msg: 'in queue'
        };
    }

    return {
        code: 0,
        data: '',
        msg: 'in queue'
    };
}

const schema = {
    description: 'recieve proof result from proof-generator',
    tags: ["Proof"],
    body: {
        type: "object",
        properties: (ProofTaskDtoSchma as any).properties,
    },
    response: {
        200: {
            type: "object",
            properties: {
                code: {
                    type: 'number',
                    description: '0: success, 1: failure.'
                },
                data: {
                    type: 'string'
                },
                msg: {
                    type: 'string',
                    description: 'the reason or msg related to \'code\''
                }
            },
        }
    }
}

