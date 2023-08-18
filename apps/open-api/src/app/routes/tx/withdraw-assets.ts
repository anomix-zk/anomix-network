
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { WithdrawInfo } from "@anomix/dao";
import { BaseResponse, WithdrawNoteStatus, WithdrawAssetReqDto, WithdrawAssetReqDtoSchema } from "@anomix/types";
import { Signature, PublicKey, Field } from "snarkyjs";
import { $axiosSeq } from "@/lib/api";

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
    const { l1addr, noteCommitment } = req.body

    const withdrawInfoRepository = getConnection().getRepository(WithdrawInfo)
    try {
        const previousWithdrawInfoList = await withdrawInfoRepository.find({
            where: {
                ownerPk: l1addr,
                assetId: '1',// default Mina
            }
        }) ?? [];

        if (previousWithdrawInfoList.length == 0) {
            return {
                code: 1,
                data: '',
                msg: 'no PENDING withdraw info found!'
            };
        }

        const processingOne = previousWithdrawInfoList.filter(wi => {
            return wi.status == WithdrawNoteStatus.PROCESSING;
        })[0];
        // due to need update USER_NULLIFIER_TREE root at user's tokenAccount<L1Addr, AssetID>, withdrawal should be in sequence.
        if (processingOne.outputNoteCommitment == noteCommitment) {
            return {
                code: 1,
                data: '',
                msg: `Please wait for last withdraw of <${l1addr}, assetId:${processingOne!.assetId}, assetNote: ${noteCommitment}> to be done!`
            };
        }

        const targetOne = previousWithdrawInfoList.filter(wi => {
            return wi.outputNoteCommitment == noteCommitment;
        })[0];
        if (!(targetOne?.status == WithdrawNoteStatus.PENDING)) {
            return {
                code: 1,
                data: '',
                msg: 'no PENDING withdraw info found!'
            };
        }

        //send to 'Sequencer' for further handle.
        return await $axiosSeq.post<BaseResponse<string>>('/tx/withdraw', { l1addr, noteCommitment }).then(r => r.data);

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
        required: ['l1addr', 'noteCommitment']
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

