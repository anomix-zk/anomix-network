import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { L2Tx } from "@anomix/dao";
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

    let blockList: number[] = [];

    if (assetInBlockReqDto.flag == 0) {
        blockList = assetInBlockReqDto.blocks;
    } else {
        const start = assetInBlockReqDto.range.start;
        const end = assetInBlockReqDto.range.end;
        const gap = end - start;
        for (let index = start; index <= gap; index++) {
            blockList.push(index);
        }
    }

    const blockTxListMap = new Map<number, AssetsInBlockDto>();
    blockList.forEach(blockNum => {
        blockTxListMap.set(blockNum, {
            blockHeight: blockNum,
            txList: [],
            timestamp: 0
        });
    });

    try {
        const txRepository = getConnection().getRepository(L2Tx)
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
                blockId: In(blockList)
            }
        }).then(txList => {
            console.log('query txList: ', JSON.stringify(txList));

            txList.forEach(tx => {
                blockTxListMap.get(tx.blockId)?.txList.push({
                    txHash: tx.txHash,
                    output1: {
                        data: (tx.encryptedData1 as any) as EncryptedNote,
                        index: tx.outputNoteCommitmentIdx1
                    },
                    output2: {
                        data: (tx.encryptedData2 as any) as EncryptedNote,
                        index: tx.outputNoteCommitmentIdx2
                    },
                    nullifier1: tx.nullifier1,
                    nullifier2: tx.nullifier2
                });
            });
        });

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
    description: 'query encrypted assets in blocks',
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

