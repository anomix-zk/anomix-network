
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { WithdrawInfo } from "@anomix/dao";
import { BaseResponse, WithdrawNoteStatus, WithdrawAssetReqDto, WithdrawAssetReqDtoSchema } from "@anomix/types";
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

export const handler: RequestHandler<WithdrawAssetReqDto, null> = async function (
    req,
    res
): Promise<BaseResponse<string>> {
    const { l1addr, noteCommitment, signature } = req.body

    // check sig to avoid evil requests.
    const rs = Signature.fromJSON(signature).verify(PublicKey.fromBase58(l1addr), [Field(noteCommitment)]);
    if (rs) {
        throw req.throwError(httpCodes.BAD_REQUEST, "signature verified fail!")
    }
    // check if exist in db
    const withdrawInfoRepository = getConnection().getRepository(WithdrawInfo)
    try {
        const withdrawInfoList = await withdrawInfoRepository.find({
            where: {
                ownerPk: l1addr,
                outputNoteCommitment: noteCommitment,
                status: WithdrawNoteStatus.PENDING
            }
        });
        if (withdrawInfoList) {
            return {
                code: 1,
                data: '',
                msg: 'no PENDING withdraw info found!'
            };
        }
        // TODO send to 'Sequencer' for further handle.
        //
        //

        return {
            code: 0,
            data: '',
            msg: 'in queue'
        };

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query withdrawal notes by L1addr',
    tags: ["L2Tx"],
    body: {
        type: "object",
        properties: (WithdrawAssetReqDtoSchema as any).properties,
        required: ['l1addr', 'noteCommitment', 'signature']
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

