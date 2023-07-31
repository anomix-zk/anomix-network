import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { Connection, In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { BlockProverOutputEntity, L2Tx } from "@anomix/dao";
import { BaseResponse, EncryptedNote, AssetInBlockReqDto, AssetInBlockReqDtoSchema, AssetsInBlockDto, AssetsInBlockDtoSchema } from '@anomix/types'

export const queryAssetsInBlocks: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/assets",
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
            select: [
                'txHash',
                'outputNoteCommitmentIdx1',
                'encryptedData1',
                'outputNoteCommitmentIdx2',
                'encryptedData1',
                'nullifier1',
                'nullifier2'
            ],
            where: {
                blockId: In(blockNumList)
            }
        }).then(txList => {
            console.log('query txList: ', JSON.stringify(txList));

            txList.forEach(tx => {
                blockTxListMap.get(tx.blockId)?.txList.push({
                    txHash: tx.txHash,
                    outputNote1: {
                        data: (tx.encryptedData1 as any) as EncryptedNote,
                        index: tx.outputNoteCommitmentIdx1
                    },
                    outputNote2: {
                        data: (tx.encryptedData2 as any) as EncryptedNote,
                        index: tx.outputNoteCommitmentIdx2
                    },
                    nullifier1: tx.nullifier1,
                    nullifier2: tx.nullifier2
                });
            });
        });

        const blockEntities = await connection.getRepository(BlockProverOutputEntity).find({
            select: [
                'id',
                'blockHash',
                'l1TxHash',
                'status',
                'createdAt',
                'updatedAt'
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
                dto.finalizedTs = blockEntity.updatedAt.getTime();
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

