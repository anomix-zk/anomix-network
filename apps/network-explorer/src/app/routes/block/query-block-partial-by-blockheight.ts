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
 * query partial fields by BlockHeight
 */
export const queryPartialByBlockHeight: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/block/paitial-fields",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<{ blockHeightList: number[], fieldNames: string[] }, null> = async function (
    req,
    res
): Promise<BaseResponse<object>> {
    const blockHeightList = req.body.blockHeightList;
    if (blockHeightList.some(b => b <= 0)) {
        return {
            code: 1,
            data: undefined,
            msg: 'There are blockHeight <= 0.'
        }
    }

    const connection = getConnection();
    const data = {} as any;
    try {
        const blockRepository = connection.getRepository(Block);
        // query latest block
        const blockEntityList = (await blockRepository.find({
            select: [
                'id',
                'finalizedAt'
                /*,
                'blockHash',
                'l1TxHash',
                'status',
                'createdAt',
                */
            ],
            where: {
                id: In(blockHeightList)
            }
        }));

        const ids = blockEntityList.map(b => b.id);
        if (blockHeightList.some(h => !ids.includes(h))) {
            return {
                code: 1,
                data: undefined,
                msg: 'There are excessing blockHeight.'
            }
        }

        blockEntityList.forEach(b => data[`${b.id}`] = b.finalizedAt?.getTime() ?? 0);

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
    tags: ["Block"],
    body: {
        type: 'object',
        properties: {
            blockHeightList: {
                type: "array",
                items: {
                    type: "number"
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
