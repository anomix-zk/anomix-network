
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { WithdrawInfo } from "@anomix/dao";
import { WithdrawInfoDtoSchema, BaseResponse } from "@anomix/types";
import { Signature, PublicKey, Field } from "snarkyjs";

/**
* 提现场景中，用户提供noteCommitment, 服务器执行合约并协助提现
*/
export const withdrawAsset: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx/withdraw",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<{ l1addr: string, noteCommitment: string, signature: any }, null> = async function (
    req,
    res
): Promise<BaseResponse<WithdrawInfo[]>> {
    const { l1addr, noteCommitment, signature } = req.body

    // check sig to avoid evil requests.
    const rs = Signature.fromJSON(signature).verify(PublicKey.fromBase58(l1addr), [Field(noteCommitment)]);

    const withdrawInfoRepository = getConnection().getRepository(WithdrawInfo)
    try {
        const withdrawInfoList = await withdrawInfoRepository.find({ where: { ownerPk: l1addr } });
        return {
            code: 0,
            data: (withdrawInfoList ?? []) as WithdrawInfo[],
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

