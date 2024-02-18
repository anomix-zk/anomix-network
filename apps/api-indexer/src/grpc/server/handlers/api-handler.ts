import { AssetInBlockReqDto, AssetsInBlockDto, BaseResponse, BlockStatus, DepositProcessingSignal, DepositTransCacheType, FlowTask, FlowTaskType, L2TxSimpleDto, L2TxStatus, MerkleProofDto, MerkleTreeId, ProofTaskDto, ProofTaskType, ProofVerifyReqDto, ProofVerifyReqType, RollupTaskDto, WithdrawAssetReqDto, WithdrawEventFetchRecordStatus, WithdrawInfoDto, WithdrawNoteStatus } from "@anomix/types";
import process from "process";
import { DATA_TREE_HEIGHT, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, NULLIFIER_TREE_HEIGHT, ROOT_TREE_HEIGHT, WithdrawNoteWitnessData } from "@anomix/circuits";
import { getLogger } from "@/lib/logUtils";
import config from "@/lib/config";
import { verify } from "o1js";
import { Account, Block, DepositProcessorSignal, DepositProverOutput, DepositTreeTrans, DepositTreeTransCache, L2Tx, MemPlL2Tx, WithdrawEventFetchRecord, WithdrawInfo } from '@anomix/dao';
import { getConnection, In } from "typeorm";
import { checkAccountExists } from "@anomix/utils";
import {
    Field,
    PublicKey,
    VerificationKey
} from 'o1js';
import { StandardIndexedTree } from "@anomix/merkle-tree";
import { randomUUID } from "crypto";
import { PrivateKey } from "o1js";
import fs from "fs";


const logger = getLogger('api-handler');

export async function checkAcctViewKeyRegistered(dto: { acctViewKey: string, includePending: boolean }) {

    const { acctViewKey, includePending } = dto

    const connection = getConnection();
    const accountRepository = connection.getRepository(Account)
    try {
        let code = 0;   // registered!
        let data = true;
        let msg = '';
        const account = await accountRepository.findOne({ where: { acctPk: acctViewKey } });
        if (account /* && includePending */) {
            const mpL2TxRepo = connection.getRepository(MemPlL2Tx);
            const mpL2Tx = await mpL2TxRepo.findOne(account.l2TxHash);
            if (!mpL2Tx) {
                const l2TxRepo = connection.getRepository(L2Tx);
                const l2Tx = await l2TxRepo.findOne(account.l2TxHash);
                if (!l2Tx) {
                    code = 1;   // not registered!
                    data = false;
                }

            } else {
                const status = (mpL2Tx)!.status;
                if (status == L2TxStatus.FAILED) {
                    code = 1;   // not registered!
                    data = false;
                } else if (status == L2TxStatus.PENDING) {
                    msg = 'pending';
                }
            }
        } else {
            data = false;
            msg = 'no this account-viewing-key!'
        }

        return {
            code,
            data,
            msg
        };

    } catch (err) {
        logger.error(err);

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function checkAliasAlignWithViewKey(dto: { aliasHash: string, acctViewKey: string, includePending: boolean }) {

    const { aliasHash, acctViewKey, includePending } = dto

    const connection = getConnection();
    const accountRepository = connection.getRepository(Account)
    try {
        let code = 1;
        let data = false;
        let msg = 'account key is not aligned with alias!';

        const account = await accountRepository.findOne({ where: { aliasHash } });

        if (account) {
            if (account.acctPk == acctViewKey) {
                const mpL2TxRepo = connection.getRepository(MemPlL2Tx);
                const mpL2tx = await mpL2TxRepo.findOne(account.l2TxHash);
                if (mpL2tx) {
                    const status = mpL2tx.status;
                    if (status == L2TxStatus.FAILED) {
                        code = 1;   // not registered!
                        data = false;
                        msg = 'last register l2tx is failed!'
                    } else if (includePending) {
                        code = 0;
                        data = true;
                        if (status == L2TxStatus.PENDING) {
                            msg = 'last register l2tx is pending.';
                        }
                    }
                } else {
                    code = 0;
                    data = true;
                    msg = 'account key is aligned with alias!';
                }
            }
        }

        return {
            code,
            data,
            msg
        };

    } catch (err) {
        logger.error(err);

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function checkAliasRegister(dto: { aliashash: string, includePending: boolean }) {

    const { aliashash: p_aliashash, includePending } = dto

    const connection = getConnection();
    const accountRepository = connection.getRepository(Account)
    try {
        let code = 0;// registered!
        let data = true;
        let msg = '';
        const account = await accountRepository.findOne({ where: { aliasHash: p_aliashash } });
        if (account /* && includePending */) {
            const mpL2TxRepo = connection.getRepository(MemPlL2Tx);
            const mpL2Tx = await mpL2TxRepo.findOne(account.l2TxHash);
            if (!mpL2Tx) {
                const l2TxRepo = connection.getRepository(L2Tx);
                const l2Tx = await l2TxRepo.findOne(account.l2TxHash);
                if (!l2Tx) {
                    code = 1;// not registered!
                    data = false;
                }

            } else {
                const status = (mpL2Tx)!.status;
                if (status == L2TxStatus.FAILED) {
                    code = 1;// not registered!
                    data = false;
                } else if (status == L2TxStatus.PENDING) {
                    msg = 'pending';
                }
            }

        } else {
            data = false;
            msg = 'no this alias!'
        }

        return {
            code,
            data,
            msg
        };

    } catch (err) {
        logger.error(err);

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryAcctViewKeyByAlias(dto: { aliashash: string }) {

    const { aliashash: p_aliashash } = dto

    const accountRepository = getConnection().getRepository(Account)
    try {
        const accountList = await accountRepository.find({ where: { aliasHash: p_aliashash } }) ?? [];
        if (accountList.length > 0) {
            return {
                code: 0,
                data: accountList.map(acct => {
                    return acct.acctPk;
                }),
                msg: ''
            };
        }

        return {
            code: 0,
            data: undefined,
            msg: ''
        };

    } catch (err) {
        logger.error(err);

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryAliasByAcctViewKey(dto: { acctvk: string }) {

    const { acctvk: p_acctvk } = dto
    const accountRepository = getConnection().getRepository(Account)
    try {
        const account = await accountRepository.findOne({ where: { acctPk: p_acctvk } });
        if (account) {
            return {
                code: 0, data: {
                    alias: account?.aliasHash,
                    aliasInfo: account?.encrptedAlias
                }, msg: ''
            }
        }
        return {
            code: 0, data: undefined, msg: ''
        }
    } catch (err) {
        logger.error(err);

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryAssetsInBlocks(dto: AssetInBlockReqDto) {

    const assetInBlockReqDto = dto;

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

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}
