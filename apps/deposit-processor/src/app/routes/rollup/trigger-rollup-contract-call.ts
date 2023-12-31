
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, DepositProcessingSignal, FlowTask, FlowTaskType, MerkleTreeId, ProofTaskDto, ProofTaskType } from "@anomix/types";
import { getConnection } from "typeorm";
import { DepositProcessorSignal, DepositProverOutput } from "@anomix/dao";
import config from "@/lib/config";
import { PrivateKey } from "o1js";
import { $axiosProofGenerator, getDateString } from "@/lib";
import fs from "fs";
import { getLogger } from "@/lib/logUtils";
import { randomUUID } from "crypto";

const logger = getLogger('triggerContractCall');

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

        const connection = getConnection();
        const depositProcessorSignalRepo = connection.getRepository(DepositProcessorSignal);
        const depositProcessorSignal = (await depositProcessorSignalRepo.findOne({ where: { type: 0 } }))!;

        if (depositProcessorSignal.signal == DepositProcessingSignal.CAN_TRIGGER_CONTRACT) {
            const depositProverOutputRepo = connection.getRepository(DepositProverOutput);
            const depositProverOutput = await depositProverOutputRepo.findOne({ where: { transId } });
            const proofTaskDto = {
                taskType: ProofTaskType.ROLLUP_FLOW,
                index: { uuid: randomUUID().toString() },
                payload: {
                    flowId: undefined as any,
                    taskType: FlowTaskType.DEPOSIT_UPDATESTATE,
                    data: {
                        transId,
                        feePayer: PrivateKey.fromBase58(config.txFeePayerPrivateKey).toPublicKey().toBase58(),
                        fee: 200_000_000,// 0.2 Mina as fee
                        data: JSON.parse(depositProverOutput!.output)
                    }
                } as FlowTask<any>
            } as ProofTaskDto<any, FlowTask<any>>;

            const fileName = './DEPOSIT_UPDATESTATE_proofTaskDto_proofReq' + getDateString() + '.json';
            fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
            logger.info(`save proofTaskDto into ${fileName}`);

            // trigger directly
            await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
                if (r.data.code == 1) {
                    throw new Error(r.data.msg);
                }
            }).catch(reason => {
                console.log(reason);
            });
        }

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
