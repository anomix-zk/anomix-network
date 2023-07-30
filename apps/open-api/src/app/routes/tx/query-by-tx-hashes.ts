/**
* 供client根据TxId查询L2 tx的状态、数据
*/
// GET /tx/id/:id
import { L2Tx, MemPlL2Tx } from '@anomix/dao'
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { BaseResponse, L2TxRespDtoSchema } from '@anomix/types'

import { L2TxRespDto } from '@anomix/types'
import { RequestHandler } from '@/lib/types'

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
        const mpL2TxRepository = getConnection().getRepository(MemPlL2Tx)
        const mptxList = await mpL2TxRepository.find({
            where: {
                txHash: In(txHashList)
            }
        }) ?? [];

        let ctxList: any[] = [];
        if (mptxList.length < txHashList.length) {
            // exclude mptxList-related from txIdList
            const txHashList1: string[] = [];
            txHashList.forEach(txHash => {
                let r = false;
                for (const mptx of mptxList) {
                    if (mptx.txHash == txHash) {
                        r = true;
                        break;
                    }
                }
                if (!r) {
                    txHashList1.push(txHash);
                }
            })

            const txRepository = getConnection().getRepository(L2Tx)
            // then query confirmed tx collection
            ctxList = await txRepository.find({
                where: {
                    txHash: In(txHashList1)
                }
            }) ?? [];
        }

        return {
            code: 0,
            data: (Array.from([...ctxList, ...mptxList]) as any) as L2TxRespDto[],
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
