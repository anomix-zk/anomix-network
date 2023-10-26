
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { Block, L2Tx, WithdrawInfo } from "@anomix/dao";
import { WithdrawInfoDtoSchema, BaseResponse, WithdrawInfoDto, WithdrawNoteStatus, BlockStatus } from "@anomix/types";
import { getLogger } from "@/lib/logUtils";
import config from "@/lib/config";
import { PrivateKey } from "o1js";

const logger = getLogger('queryWithdrawalNotes');

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

export const handler: RequestHandler<{ commitments: string[] }, { l1addr: string }> = async function (
    req,
    res
): Promise<BaseResponse<WithdrawInfoDto[] | undefined>> {
    const noteCommitmentList = req.body.commitments;
    const l1addr = req.params.l1addr;

    if (!(l1addr || noteCommitmentList?.length > 0)) {
        return {
            code: 1,
            data: [],
            msg: 'both l1addr and commitments are none!'
        };
    }

    try {
        const connection = getConnection();
        const withdrawInfoRepository = connection.getRepository(WithdrawInfo);

        /* ====================== NEED PERFORMANCE IMPROVEMENT LATER ======================*/
        const queryBuilder = withdrawInfoRepository.createQueryBuilder('wi').andWhere(`wi.assetId = '${1}'`)
        if (l1addr) {
            queryBuilder.andWhere(`wi.ownerPk = '${l1addr}'`)
        }
        if (noteCommitmentList?.length > 0) {
            queryBuilder.andWhere(`wi.outputNoteCommitment in (${noteCommitmentList.map(c => `'${c}'`).join(',')})`);
        }
        let withdrawInfoList = (await queryBuilder.getMany()) ?? [];

        if (noteCommitmentList?.length == 1 && withdrawInfoList.length == 1) {// when the commitment is existing in db
            if (withdrawInfoList[0].status == WithdrawNoteStatus.DONE) {
                return {
                    code: 1,
                    data: [],
                    msg: 'The note has been claimed already!'
                };
            }
        }

        // exclude the DONE ones.
        withdrawInfoList = withdrawInfoList.filter(w => w.status != WithdrawNoteStatus.DONE);

        const blockRepository = connection.getRepository(Block);
        const txRepository = connection.getRepository(L2Tx);
        const withdrawInfoDtoList: WithdrawInfoDto[] = [];
        for (let i = 0; i < withdrawInfoList.length; i++) {
            const wInfo = withdrawInfoList[i];
            const { createdAt, updatedAt, ...restObj } = wInfo;
            const withdrawInfoDto = (restObj as any) as WithdrawInfoDto;

            let block: Block | undefined = undefined as any;
            if (!(withdrawInfoDto.l2TxHash)) {// for querying operator txFee
                block = await blockRepository.findOne({ where: { txFeeCommitment: wInfo.outputNoteCommitment, status: BlockStatus.CONFIRMED } });
            } else {
                // then query confirmed tx collection
                const tx = await txRepository.findOne({
                    where: {
                        txHash: withdrawInfoDto.l2TxHash
                    }
                });

                block = await blockRepository.findOne({ where: { id: tx!.blockId, status: BlockStatus.CONFIRMED } });
            }

            if (block) {
                withdrawInfoDto.createdTs = block!.createdAt.getTime();
                withdrawInfoDto.finalizedTs = block!.finalizedAt.getTime();
                withdrawInfoDtoList.push(withdrawInfoDto);
            }
        }

        /* ====================== NEED PERFORMANCE IMPROVEMENT LATER ======================*/

        return {
            code: 0,
            data: withdrawInfoDtoList,
            msg: ''
        };

    } catch (err) {
        logger.error(err);
        console.error(err);
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
        }
    },
    body: {
        type: 'object',
        properties: {
            'commitments': {
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

