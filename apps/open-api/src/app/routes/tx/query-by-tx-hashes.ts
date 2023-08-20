/**
* 供client根据TxId查询L2 tx的状态、数据
*/
// GET /tx/id/:id
import { Block, L2Tx, MemPlL2Tx } from '@anomix/dao'
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { BaseResponse, L2TxRespDtoSchema, WithdrawInfoDto } from '@anomix/types'

import { L2TxRespDto } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { ActionType } from '@anomix/circuits';

/**
 * query confirmed tx by tx hashes
 */
export const queryByTxHashes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx/tx-hashes",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<L2TxRespDto[]>> {
    const txHashList = req.body

    try {
        const txRepository = getConnection().getRepository(L2Tx)
        // then query confirmed tx collection
        const ctxList = await txRepository.find({
            where: {
                txHash: In(txHashList)
            }
        }) ?? [];

        const l2TxRespDtoList = await Promise.all(ctxList.map(async tx => {
            const blockRepository = getConnection().getRepository(Block)
            const block = await blockRepository.findOne({ select: ['createdAt', 'finalizedAt'], where: { id: tx.blockId } });

            const { updatedAt, createdAt, proof, encryptedData1, encryptedData2, ...restObj } = tx;
            const txDto = (restObj as any) as L2TxRespDto;

            txDto.finalizedTs = block!.finalizedAt.getTime();
            txDto.createdTs = block!.createdAt.getTime();

            txDto.extraData = {} as any;
            txDto.extraData.outputNote1 = JSON.parse(encryptedData1);
            if (encryptedData2) {
                txDto.extraData.outputNote2 = JSON.parse(encryptedData2);
            }

            if (tx.actionType == ActionType.WITHDRAW.toString()) {// if Withdrawal
                txDto.extraData.withdrawNote = {} as any as WithdrawInfoDto;
                // query WithdrawInfoDto
                //
                /

                txDto.extraData.withdrawNote!.createdTs = txDto.createdTs;// !!!
            } else if (tx.actionType == ActionType.ACCOUNT.toString()) {// if Account
                // query account
                // 
                //

            }

            return txDto;
        }));

        return {
            code: 0,
            data: l2TxRespDtoList,
            msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query tx by txHashes',
    tags: ["L2Tx"],
    body: {
        type: "array",
        items: {
            type: "string"
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: (L2TxRespDtoSchema as any).type,
                    properties: (L2TxRespDtoSchema as any).properties,
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
