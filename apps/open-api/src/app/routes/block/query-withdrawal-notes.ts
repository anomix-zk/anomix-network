
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { Block, L2Tx, WithdrawInfo } from "@anomix/dao";
import { WithdrawInfoDtoSchema, BaseResponse, WithdrawInfoDto, WithdrawNoteStatus, BlockStatus } from "@anomix/types";
import { getLogger } from "@/lib/logUtils";

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
        /*
        const rs = await connection.createQueryBuilder()
            .select('wi').addSelect('block.createdAt').addSelect('block.finalizedAt')
            .from(WithdrawInfo, 'wi').addFrom(L2Tx, 'tx').addFrom(Block, 'block')
            .where('tx.txHash = wi.l2TxHash').andWhere('block.id = tx.blockId')
            .andWhere(`block.status = ${BlockStatus.CONFIRMED}`)
            .andWhere(`wi.ownerPk = ${l1addr}`)
            .andWhere(`wi.assetId = ${1}`)
            .andWhere(`wi.outputNoteCommitment in ${noteCommitmentList.join(',')}`).getMany() ?? [];
        */

        // select the ones whose corresponding L2Block is confirmed on Layer1!
        const queryBuilder = withdrawInfoRepository.createQueryBuilder('wi')
            .innerJoin(L2Tx, 'tx', 'tx.txHash = wi.l2TxHash')
            .innerJoinAndSelect(Block, 'block', 'block.id = tx.blockId')
            .where(`block.status = ${BlockStatus.CONFIRMED}`)
            .andWhere(`wi.assetId = '${1}'`);

        if (l1addr) {
            queryBuilder.andWhere(`wi.ownerPk = '${l1addr}'`)
        }
        if (noteCommitmentList?.length > 0) {
            queryBuilder.andWhere(`wi.outputNoteCommitment in (${noteCommitmentList.map(c => `'${c}'`).join(',')})`);
        }

        const withdrawInfoList = (await queryBuilder.getMany()) ?? [];

        const blockRepository = connection.getRepository(Block)
        const withdrawInfoDtoList = await Promise.all(withdrawInfoList.map(async wInfo => {
            const { createdAt, updatedAt, ...restObj } = wInfo;
            const withdrawInfoDto = (restObj as any) as WithdrawInfoDto;
            if (withdrawInfoDto.status == WithdrawNoteStatus.DONE) {
                withdrawInfoDto.l1TxBody = '';
            }

            const block = ((await blockRepository.createQueryBuilder('block')
                .innerJoinAndSelect(L2Tx, 'tx', 'block.id = tx.blockId')
                .where(`tx.txHash=${withdrawInfoDto.l2TxHash}`).getMany()) ?? [])[0];

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

