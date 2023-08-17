
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { Block, L2Tx, WithdrawInfo } from "@anomix/dao";
import { WithdrawInfoDtoSchema, BaseResponse, WithdrawInfoDto, WithdrawNoteStatus, BlockStatus } from "@anomix/types";

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
    const noteCommitmentList = req.body;
    const l1addr = req.params;

    try {
        const connection = getConnection();
        const withdrawInfoRepository = connection.getRepository(WithdrawInfo);

        /* ====================== NEED PERFORMANCE IMPROVEMENT LATER ======================*/
        /*
        const rs = await connection.createQueryBuilder()
            .select('wi').addSelect('block.createdAt').addSelect('block.finalizedAt')
            .from(WithdrawInfo, 'wi').addFrom(L2Tx, 'tx').addFrom(Block, 'block')
            .where('tx.id = wi.l2TxId').andWhere('block.id = tx.blockId')
            .andWhere(`block.status = ${BlockStatus.CONFIRMED}`)
            .andWhere(`wi.ownerPk = ${l1addr}`)
            .andWhere(`wi.assetId = ${1}`)
            .andWhere(`wi.outputNoteCommitment in ${noteCommitmentList.join(',')}`).getMany() ?? [];
        */

        // select the ones whose corresponding L2Block is confirmed on Layer1!
        const withdrawInfoList = (await withdrawInfoRepository.createQueryBuilder('wi')
            .innerJoin(L2Tx, 'tx', 'tx.id = wi.l2TxId')
            .innerJoinAndSelect(Block, 'block', 'block.id = tx.blockId')
            .where(`block.status = ${BlockStatus.CONFIRMED}`)
            .andWhere(`wi.ownerPk = ${l1addr}`)
            .andWhere(`wi.assetId = ${1}`)
            .andWhere(`wi.outputNoteCommitment in ${noteCommitmentList.join(',')}`).getMany()) ?? [];

        const withdrawInfoDtoList = await Promise.all(withdrawInfoList.map(async wInfo => {
            const { createdAt, updatedAt, ...restObj } = wInfo;
            const withdrawInfoDto = (restObj as any) as WithdrawInfoDto;
            if (withdrawInfoDto.status == WithdrawNoteStatus.DONE) {
                withdrawInfoDto.l1TxBody = '';
            }

            const txRepository = connection.getRepository(L2Tx)
            // then query confirmed tx collection
            const tx = await txRepository.findOne({
                where: {
                    id: withdrawInfoDto.l2TxId
                }
            });

            const blockRepository = connection.getRepository(Block)
            const block = await blockRepository.findOne({ select: ['createdAt', 'finalizedAt'], where: { id: tx!.blockId } });
            withdrawInfoDto.createdTs = block!.createdAt.getTime();
            withdrawInfoDto.finalizedTs = block!.finalizedAt.getTime();
            return withdrawInfoDto;
        }));
        /* ====================== NEED PERFORMANCE IMPROVEMENT LATER ======================*/

        return {
            code: 0,
            data: withdrawInfoDtoList,
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

