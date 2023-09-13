
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, BlockStatus, LatestBlockDto, NetworkStatusDto, NetworkStatusDtoSchema } from "@anomix/types";
import { Block } from "@anomix/dao";
import { Connection, In, getConnection, UsingJoinColumnIsNotAllowedError } from 'typeorm';

/**
 * check the network status
 */
export const networkStatus: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/network/status",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<NetworkStatusDto>> {
    try {
        const connection = getConnection();

        const blockRepository = connection.getRepository(Block);
        // query latest block
        const blockEntity = (await blockRepository.find({
            select: [
                'id',
                'blockHash',
                'l1TxHash',
                'status',
                'createdAt',
                'finalizedAt'
            ],
            order: {
                id: 'DESC'
            },
            take: 1
        }))[0];

        const latestBlockDto = {} as LatestBlockDto;
        latestBlockDto.blockHeight = blockEntity.id;
        latestBlockDto.blockHash = blockEntity.blockHash;
        latestBlockDto.l1TxHash = blockEntity.l1TxHash;
        latestBlockDto.status = blockEntity.status;
        latestBlockDto.createdTs = blockEntity.createdAt.getTime();
        latestBlockDto.finalizedTs = blockEntity.finalizedAt?.getTime();

        // query pending block count
        const pendingNum = await blockRepository.count({
            where: {
                status: BlockStatus.PENDING
            },
        });
        const confirmedNum = blockEntity.id - pendingNum;

        // TODO query pending tx count

        // TODO query deposit actions

        // TODO query worldstates

        const networkStatusDto = {} as NetworkStatusDto;
        networkStatusDto.latestBlock = latestBlockDto;
        networkStatusDto.blocks = {
            pending: pendingNum,
            confirmed: confirmedNum
        }
        return { code: 0, data: networkStatusDto, msg: '' };
    } catch (err) {
        console.error(err)

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'check the network status',
    tags: ['Network'],
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'object',
                    properties: (NetworkStatusDtoSchema as any).properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
