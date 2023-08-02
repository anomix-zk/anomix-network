
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { WithdrawInfo } from "@anomix/dao";
import { BaseResponse, WithdrawNoteStatus, WithdrawAssetReqDto, WithdrawAssetReqDtoSchema } from "@anomix/types";
import { Signature, PublicKey, Field } from "snarkyjs";
import { $axios } from "@/lib/api";

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
        const withdrawInfo = await withdrawInfoRepository.findOne({
            where: {
                ownerPk: l1addr,
                assetId: '1',// default Mina
                outputNoteCommitment: noteCommitment,
                status: WithdrawNoteStatus.PENDING
            }
        });
        if (!withdrawInfo) {
            return {
                code: 1,
                data: '',
                msg: 'no PENDING withdraw info found!'
            };
        }

        const previousWithdrawInfo = await withdrawInfoRepository.findOne({
            where: {
                ownerPk: l1addr,
                assetId: withdrawInfo.assetId,// need same tokenId
                outputNoteCommitment: noteCommitment,
                status: WithdrawNoteStatus.PROCESSING
            }
        });
        if (!previousWithdrawInfo) {
            return {
                code: 1,
                data: '',
                msg: `Please wait for last withdraw of <${l1addr}, assetId:${withdrawInfo.assetId}> to be done!`
            };
        }

        //send to 'Sequencer' for further handle.
        return await $axios.post<BaseResponse<string>>('/tx/withdraw', { l1addr, noteCommitment, signature }).then(r => r.data);

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

