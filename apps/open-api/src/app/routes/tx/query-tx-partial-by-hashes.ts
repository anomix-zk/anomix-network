/**
* 供client根据TxId查询L2 tx的状态、数据
*/
// GET /tx/id/:id
import { Account, Block, L2Tx, MemPlL2Tx, WithdrawInfo } from '@anomix/dao'
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { BaseResponse, L2TxRespDtoSchema, WithdrawInfoDto } from '@anomix/types'

import { L2TxRespDto } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { ActionType } from '@anomix/circuits';
import { getLogger } from '@/lib/logUtils';

const logger = getLogger('queryByTxHashes');
/**
 * query partial fields by tx hashes
 */
export const queryPartialByTxHashes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx/paitial-fields",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<{ txHashes: string[], fieldNames: string[] }, null> = async function (
    req,
    res
): Promise<BaseResponse<object>> {
    const txHashList = req.body.txHashes
    const connection = getConnection();

    const data = {} as any;
    try {
        const txRepository = connection.getRepository(L2Tx)
        // then query confirmed tx collection
        const ctxList = await txRepository.find({
            where: {
                txHash: In(txHashList)
            }
        }) ?? [];

        if (ctxList.length == 0) {
            return {
                code: 0,
                data,
                msg: ''
            };
        }

        const blockRepository = connection.getRepository(Block)
        const blockList = (await blockRepository.find({ select: ['createdAt', 'finalizedAt'], where: { id: In(ctxList.map(tx => tx.blockId)) } })) ?? [];
        for (const tx of ctxList) {
            data[`${tx.txHash}`] = blockList.filter(b => b.id == tx.blockId)[0].finalizedAt?.getTime();
        }

        return {
            code: 0,
            data,
            msg: ''
        };
    } catch (err) {
        logger.error(err);

        console.error(err);

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query tx by txHashes',
    tags: ["L2Tx"],
    body: {
        type: 'object',
        properties: {
            txHashes: {
                type: "array",
                items: {
                    type: "string"
                }
            },
            fieldNames: {
                type: "array",
                items: {
                    type: "string"
                }
            }
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
                    type: "object",
                    additionalProperties: { type: 'number' }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
