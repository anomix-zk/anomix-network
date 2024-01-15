import { L2Tx, MemPlL2Tx } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { TxFeeSuggestionDto, TxFeeSuggestionDtoSchema, BaseResponse, L2TxStatus } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import config from '@/lib/config';
import { getLogger } from '@/lib/logUtils';

const logger = getLogger('queryTxFeeSuggestions');

/**
 * query tx fee suggestions
 * @param instance 
 * @param options 
 * @param done 
 */
export const queryTxFeeSuggestions: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/network/txfees",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<TxFeeSuggestionDto>> {
    try {
        // TODO future improve: query sequencer
        // 当检查当前内存池如果满了，返回内存池手续费最贵那笔交易的价格+0.01. 配置300笔为内存池满。
        const connection = getConnection();
        const mpL2TxRepo = connection.getRepository(MemPlL2Tx);
        const cnt = await mpL2TxRepo.count();

        let normalFee = config.txFeeFloor;
        if (cnt >= config.maxMpTxCnt) {
            const mpL2TxList = await mpL2TxRepo.find({ where: { status: L2TxStatus.PENDING }, select: ['txFee'] }) ?? [];
            const maxTxFee = (mpL2TxList.sort((a, b) => { return Number(a.txFee) - Number(b.txFee) })[0]?.txFee);
            if (maxTxFee) {
                normalFee = Number(maxTxFee) + 1;
            }
        }

        return {
            code: 0,
            data: {
                assetId: 0,
                faster: config.minMpTxFeeToGenBlock,
                normal: normalFee
            },
            msg: ''
        };
    } catch (err) {
        logger.error(err);
        console.error(err);
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query tx fees suggestions',

    tags: ["Network"],
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: "object",
                    properties: (TxFeeSuggestionDtoSchema as any).properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
