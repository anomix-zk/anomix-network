import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, ProofVerifyReqDto, ProofVerifyReqType, ProofVerifyReqDtoSchma } from "@anomix/types";
import { JoinSplitProof } from "@anomix/circuits";
import { getLogger } from "@/lib/logUtils";
import config from "@/lib/config";
import { verify, Field, PublicKey, Poseidon, UInt64 } from "o1js";
import { MemPlL2Tx } from '@anomix/dao'
import { $axiosProofGeneratorProofVerify0, $axiosProofGeneratorProofVerify1 } from "@/lib";

const logger = getLogger('proofVerifyEndpoint');

/**
* recieve proof-verify req from openApi
*/
export const proofVerifyEndpoint: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/proof-verify",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

const handler: RequestHandler<ProofVerifyReqDto, null> = async function (
    req,
    res
): Promise<BaseResponse<{ flag: boolean, l2txStr: string }>> {
    const { type, index, proof } = req.body

    logger.info(`recieve a req for verify proof...`);
    logger.info(`type: ${ProofVerifyReqType[type]}`);

    logger.info(`try to call ProofVerifyWebServer8085...`);
    const verifyRs8085 = await $axiosProofGeneratorProofVerify0.post<BaseResponse<{ flag: boolean, l2txStr: string }>>('/joinsplit-proof-verify',
        req.body as ProofVerifyReqDto).then(r => {
            return r.data;
        });

    if (verifyRs8085?.code != 0) {
        logger.info(`verification result from WebServer8085: ${verifyRs8085?.msg}`);

        logger.info(`then, try to call ProofVerifyWebServer8086...`);
        const verifyRs8086 = await $axiosProofGeneratorProofVerify1.post<BaseResponse<{ flag: boolean, l2txStr: string }>>('/joinsplit-proof-verify',
            req.body as ProofVerifyReqDto).then(r => {
                return r.data;
            });

        if (verifyRs8086?.code == -1 && verifyRs8085?.code == 2) {
            return verifyRs8085;
        }
        return verifyRs8086;
    }
    logger.info('end.');
    return verifyRs8085;
}

const schema = {
    description: 'recieve proof-verify req from openApi',
    tags: ["Proof"],
    body: {
        type: "object",
        properties: (ProofVerifyReqDtoSchma as any).properties,
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
                    type: 'object',
                    properties: {
                        flag: {
                            type: 'boolean'
                        },
                        l2txStr: {
                            type: 'string'
                        }
                    }
                },
                msg: {
                    type: 'string',
                    description: 'the reason or msg related to \'code\''
                }
            },
        }
    }
}

