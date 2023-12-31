import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { Connection, In, getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { Account, Block, L2Tx, WithdrawInfo } from "@anomix/dao";
import { BaseResponse, EncryptedNote, AssetInBlockReqDto, AssetInBlockReqDtoSchema, AssetsInBlockDto, AssetsInBlockDtoSchema, L2TxSimpleDto, WithdrawNoteStatus, WithdrawInfoDto } from '@anomix/types'
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('queryAssetsInBlocks');
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

const cachedBlockTxListMap = new Map<number, AssetsInBlockDto>();

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
        for (let index = start; index <= end; index++) {
            blockNumList.push(index);
        }
    }

    try {
        // query latest block
        const connection = getConnection();
        const blockRepository = await connection.getRepository(Block);
        const blockEntity = (await blockRepository.find({
            select: [
                'id'
                /*,
                'blockHash',
                'l1TxHash',
                'status',
                'createdAt',
                'finalizedAt'
                */
            ],
            order: {
                id: 'DESC'
            },
            take: 1
        }))[0];

        if (!blockEntity) {
            logger.info('blockEntity is undefined.')
            return {
                code: 0,
                data: [],
                msg: ''
            };
        }

        const blockTxListMap1 = new Map<number, AssetsInBlockDto>();
        const blockNumList1: number[] = [];
        blockNumList.forEach(blockNum => {
            if (blockNum > blockEntity.id) {// rid the ones higher than the latest block height.
                return;
            }

            if (!cachedBlockTxListMap.get(blockNum)) {
                blockTxListMap1.set(blockNum, ({
                    blockHeight: blockNum,
                    txList: [],
                    createdTs: 0,
                    finalizedTs: 0
                } as unknown) as AssetsInBlockDto);

                blockNumList1.push(blockNum);

            } else {
                blockTxListMap1.set(blockNum, cachedBlockTxListMap.get(blockNum)!);
            }
        });

        if (blockNumList1.length > 0) {
            const txRepository = connection.getRepository(L2Tx)
            // then query confirmed tx collection
            await txRepository.find({
                where: {
                    blockId: In(blockNumList1)
                },
                order: { indexInBlock: 'ASC' }
            }).then(async txList => {
                logger.info('query txList: ', JSON.stringify(txList));

                for (const tx of txList) {
                    const { proof, blockId, blockHash, updatedAt, createdAt, encryptedData1, encryptedData2, ...restObj } = tx;
                    const dto = restObj as any as L2TxSimpleDto;

                    let withdrawInfoDto: any = undefined;
                    const withdrawInfoRepository = connection.getRepository(WithdrawInfo);
                    const wInfo = await withdrawInfoRepository.findOne({ where: { l2TxHash: tx.txHash } });
                    if (wInfo) {
                        const { createdAt: createdAtW, updatedAt: updatedAtW, ...restObjW } = wInfo!;
                        withdrawInfoDto = (restObjW as any) as WithdrawInfoDto;
                        if (withdrawInfoDto.status == WithdrawNoteStatus.DONE) {
                            withdrawInfoDto.l1TxBody = '';
                        }
                    }

                    const accountRepository = connection.getRepository(Account)
                    const account = await accountRepository.findOne({ where: { l2TxHash: tx.txHash } });

                    dto.extraData = {
                        outputNote1: encryptedData1 ? JSON.parse(encryptedData1) : undefined,
                        outputNote2: encryptedData2 ? JSON.parse(encryptedData2) : undefined,
                        aliasHash: account?.aliasHash,
                        accountPublicKey: account?.acctPk,
                        aliasInfo: account?.encrptedAlias,
                        withdrawNote: withdrawInfoDto
                    }

                    blockTxListMap1.get(tx.blockId)?.txList.push(dto);
                }

            });

            const blockEntities = await blockRepository.find({
                select: [
                    'id',
                    'blockHash',
                    'l1TxHash',
                    'status',
                    'createdAt',
                    'finalizedAt'
                ],
                where: {
                    id: In(blockNumList1)
                }
            });

            blockEntities?.forEach(blockEntity => {
                const dto = blockTxListMap1.get(blockEntity.id);
                if (dto) {
                    logger.info(`block.id: ${blockEntity.id}, block.createdAt.getTime(): ${blockEntity.createdAt.getTime()}`);
                    dto.blockHash = blockEntity.blockHash;
                    dto.l1TxHash = blockEntity.l1TxHash;
                    dto.status = blockEntity.status;
                    dto.createdTs = blockEntity.createdAt.getTime();
                    dto.finalizedTs = blockEntity.finalizedAt?.getTime() ?? 0;
                }
            })

        }

        // to refresh cached 
        const unfinalizedBlockIdList = new Array<number>();
        blockTxListMap1.forEach(function (value, key, map) {
            if (value.txList.length > 0) {
                if (value.finalizedTs == 0 && !blockNumList1.includes(value.blockHeight)) {
                    unfinalizedBlockIdList.push(value.blockHeight);
                }
            }
        });
        const checkIfUnfinalizedBlocks = unfinalizedBlockIdList.length == 0 ? [] : (await blockRepository.find({
            select: [
                'id',
                'finalizedAt'
            ],
            where: {
                id: In(unfinalizedBlockIdList)
            }
        }) ?? []);

        const data = new Array<AssetsInBlockDto>();
        blockTxListMap1.forEach(function (value, key, map) {
            if (value.txList.length > 0) {
                value.finalizedTs = checkIfUnfinalizedBlocks.find(b => b.id == value.blockHeight)?.finalizedAt?.getTime() ?? value.finalizedTs;

                data.push(value);

                cachedBlockTxListMap.set(key, value);// record valid new ones into cache
            }
        });

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

