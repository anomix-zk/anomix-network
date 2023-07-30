
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { WithdrawInfo, WithdrawNoteStatus } from "@anomix/dao";
import { WithdrawInfoDtoSchema, BaseResponse, WithdrawInfoDto } from "@anomix/types";

/**
* 提现场景中，提供L1Addr来查询相关的所有pending value notes
*/
export const queryWithdrawalNotes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx/withdraw/:l1addr",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], string> = async function (
    req,
    res
): Promise<BaseResponse<WithdrawInfoDto[]>> {
    const l1addr = req.params;
    const noteCommitments = req.body;

    const whereConditions: { ownerPk: string, outputNoteCommitment?: any } = { ownerPk: l1addr };
    if (noteCommitments?.length == 1) {
        whereConditions.outputNoteCommitment = noteCommitments[0];
    } else if (noteCommitments?.length > 1) {
        whereConditions.outputNoteCommitment = In(noteCommitments);
    }

    const withdrawInfoRepository = getConnection().getRepository(WithdrawInfo)
    try {
        const withdrawInfoList = (await withdrawInfoRepository.find({ where: whereConditions })) ?? [];
        withdrawInfoList.forEach(wInfo => {
            if (wInfo.status == WithdrawNoteStatus.DONE) {
                wInfo.l1TxBody = '';
            }
        });
        return {
            code: 0,
            data: (withdrawInfoList ?? [] as any) as WithdrawInfoDto[],
            msg: ''
        };

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query withdrawal notes by L1addr',
    tags: ["L2Tx"],
    params: {
        type: "object",
        properties: {
            'l1addr': {
                type: "string",
            }
        },
        required: ['l1addr']
    },
    body: {
        type: 'object',
        properties: {
            'noteCommitments': {
                type: "array",
                items: {
                    type: "string"
                }
            }
        },
    },
    response: {
        200: {
            type: "object",
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: "array",
                    items: {
                        type: (WithdrawInfoDtoSchema as any).type,
                        properties: (WithdrawInfoDtoSchema as any).properties,
                    }
                },
                msg: {
                    type: 'string'
                }
            },
        }
    }
}

