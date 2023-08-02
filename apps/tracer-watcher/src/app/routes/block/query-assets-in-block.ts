import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { Connection, In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { Account, BlockProverOutputEntity, L2Tx, WithdrawInfo } from "@anomix/dao";
import { BaseResponse, EncryptedNote, AssetInBlockReqDto, AssetInBlockReqDtoSchema, AssetsInBlockDto, AssetsInBlockDtoSchema, L2TxSimpleDto, WithdrawNoteStatus, WithdrawInfoDto } from '@anomix/types'

export const queryAssetsInBlocks: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/block/assets",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<AssetInBlockReqDto, null> = async function (
    req,
    res
): Promise<BaseResponse<AssetsInBlockDto[]>> {
    const assetInBlockReqDto = req.body;

    let blockNumList: number[] = [];

    if (assetInBlockReqDto.flag == 0) {
        blockNumList = assetInBlockReqDto.blocks!;
    } else {
        const start = assetInBlockReqDto.range!.from;
        const end = start + assetInBlockReqDto.range!.take - 1;
        const gap = end - start;
        for (let index = start; index <= gap; index++) {
            blockNumList.push(index);
        }
    }

    const blockTxListMap = new Map<number, AssetsInBlockDto>();
    blockNumList.forEach(blockNum => {
        blockTxListMap.set(blockNum, ({
            blockHeight: blockNum,
            txList: [],
            createdTs: 0,
            finalizedTs: 0
        } as unknown) as AssetsInBlockDto);
    });

    try {
        const connection = getConnection();
        const txRepository = connection.getRepository(L2Tx)
        // then query confirmed tx collection
        await txRepository.find({
            where: {
                blockId: In(blockNumList)
            },
            order: { indexInBlock: 'ASC' }
        }).then(async txList => {
            console.log('query txList: ', JSON.stringify(txList));

            await txList.forEach(async tx => {
                const { proof, blockId, blockHash, updatedAt, createdAt, encryptedData1, encryptedData2, ...restObj } = tx;
                const dto = restObj as any as L2TxSimpleDto;

                const withdrawInfoRepository = connection.getRepository(WithdrawInfo);
                const wInfo = await withdrawInfoRepository.findOne({ where: { l2TxId: tx.id } });
                const { createdAt: createdAtW, updatedAt: updatedAtW, ...restObjW } = wInfo!;
                const withdrawInfoDto = (restObjW as any) as WithdrawInfoDto;
                if (withdrawInfoDto.status == WithdrawNoteStatus.DONE) {
                    withdrawInfoDto.l1TxBody = '';
                }

                const accountRepository = connection.getRepository(Account)
                const account = await accountRepository.findOne({ where: { l2TxId: tx.id } });

                dto.extraData = {
                    outputNote1: JSON.parse(encryptedData1),
                    outputNote2: encryptedData2 ? {} : JSON.parse(encryptedData2),
                    aliasHash: account!.aliasHash,
                    accountPublicKey: account!.acctPk,
                    withdrawNote: withdrawInfoDto
                }

                blockTxListMap.get(tx.blockId)?.txList.push(dto);
            });
        });

        const blockEntities = await connection.getRepository(BlockProverOutputEntity).find({
            select: [
                'id',
                'blockHash',
                'l1TxHash',
                'status',
                'createdAt',
                'finalizedAt'
            ],
            where: {
                blockId: In(blockNumList)
            }
        });

        blockEntities?.forEach(blockEntity => {
            const dto = blockTxListMap.get(blockEntity.id);
            if (dto) {
                dto.blockHash = blockEntity.blockHash;
                dto.l1TxHash = blockEntity.l1TxHash;
                dto.status = blockEntity.status;
                dto.createdTs = blockEntity.createdAt.getTime();
                dto.finalizedTs = blockEntity.finalizedAt.getTime();
            }
        })

        const data = new Array<AssetsInBlockDto>();
        blockTxListMap.forEach(function (value, key, map) {
            data.push(value);
        });
        return {
            code: 0,
            data,
            msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query assets in blocks',
    tags: ["Block"],
    body: {
        type: (AssetInBlockReqDtoSchema as any).type,
        properties: (AssetInBlockReqDtoSchema as any).properties,
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'array',
                    items: {
                        type: (AssetsInBlockDtoSchema as any).type,
                        properties: (AssetsInBlockDtoSchema as any).properties,
                    }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
