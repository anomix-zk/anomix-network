import { Account, L2Tx, MemPlL2Tx, WithdrawInfo } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { FindOperator, getConnection, In } from 'typeorm';

import { L2TxRespDto, BaseResponse, L2TxRespDtoSchema, L2TxStatus, L2TxSimpleDto, WithdrawInfoDto, WithdrawNoteStatus } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getLogger } from '@/lib/logUtils';

const logger = getLogger('queryPendingTxs');

/**
 * return pending txs by tx hashes
 * @param instance 
 * @param options 
 * @param done 
 */
export const queryPendingTxs: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx/pending-txs",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<L2TxSimpleDto[]>> {
    const txHashList = req.body

    const connection = getConnection();
    try {
        const mpL2TxRepository = connection.getRepository(MemPlL2Tx)

        // first query memory pool
        const whereConditions = { status: In([L2TxStatus.PENDING, L2TxStatus.PROCESSING]) };
        if (txHashList?.length > 0) {
            (whereConditions as any).txHash = In(txHashList);
        }
        const txList = await mpL2TxRepository.find({ where: whereConditions }) ?? [];
        const l2TxSimpleDtoList = await Promise.all(txList.map(async tx => {
            const { proof, blockId, blockHash, updatedAt, createdAt, encryptedData1, encryptedData2, ...restObj } = tx;
            const dto = restObj as any as L2TxSimpleDto;

            let withdrawInfoDto = undefined as any as WithdrawInfoDto;
            const withdrawInfoRepository = connection.getRepository(WithdrawInfo);
            const wInfo = await withdrawInfoRepository.findOne({ where: { l2TxHash: tx.txHash } });
            if (wInfo) {
                const { createdAt: createdAtW, updatedAt: updatedAtW, ...restObjW } = wInfo;
                withdrawInfoDto = (restObjW as any) as WithdrawInfoDto;

                if (withdrawInfoDto.status == WithdrawNoteStatus.DONE) {
                    withdrawInfoDto.l1TxBody = '';
                }
            }

            const accountRepository = connection.getRepository(Account)
            const account = await accountRepository.findOne({ where: { l2TxHash: tx.txHash } });

            dto.extraData = {
                outputNote1: JSON.parse(encryptedData1),
                outputNote2: encryptedData2 ? JSON.parse(encryptedData2) : undefined,
                aliasHash: account?.aliasHash,
                accountPublicKey: account?.acctPk,
                withdrawNote: withdrawInfoDto
            }

            return dto;
        }));
        return {
            code: 0,
            data: l2TxSimpleDtoList,
            msg: ''
        };
    } catch (err) {
        logger.error(err);
        console.error(err);
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query all pending txs',
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
                    type: "array",
                    items: {
                        type: (L2TxRespDtoSchema as any).type,
                        properties: (L2TxRespDtoSchema as any).properties,
                    }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
