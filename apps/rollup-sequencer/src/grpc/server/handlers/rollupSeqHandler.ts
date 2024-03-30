import { BaseResponse, BlockStatus, MerkleProofDto, MerkleTreeId, ProofTaskDto, ProofTaskType, ProofVerifyReqDto, ProofVerifyReqType, RollupTaskDto, WithdrawAssetReqDto, WithdrawEventFetchRecordStatus, WithdrawNoteStatus } from "@anomix/types";
import process from "process";
import { $axiosProofGenerator } from "@/lib";
import { DATA_TREE_HEIGHT, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, NULLIFIER_TREE_HEIGHT, ROOT_TREE_HEIGHT, WithdrawNoteWitnessData } from "@anomix/circuits";
import { getLogger } from "@/lib/logUtils";
import config from "@/lib/config";
import { verify } from "o1js";
import { Block, L2Tx, MemPlL2Tx, WithdrawEventFetchRecord, WithdrawInfo } from '@anomix/dao';
import { getConnection, In } from "typeorm";
import { checkAccountExists } from "@anomix/utils";
import {
    Field,
    PublicKey,
    VerificationKey
} from 'o1js';
import { StandardIndexedTree } from "@anomix/merkle-tree";
import { WorldState } from "@/worldstate";
import { WithdrawDB } from "@/worldstate/withdraw-db";
import { getLogger } from "@/lib/logUtils";
import cp from "child_process";
import { Worker as WorkerThread } from "worker_threads";
import { RollupTaskType } from "@anomix/types";
import { WorldState, WorldStateDB, RollupDB, IndexDB } from "./worldstate";
import config from './lib/config';
import { activeMinaInstance } from "@anomix/utils";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const logger = getLogger('rollupSeqHandler');

// init Mina tool
await activeMinaInstance();// TODO improve it to configure graphyQL endpoint
// init mysqlDB
const rollupDB = new RollupDB();
await rollupDB.start();
// init IndexDB
const indexDB = new IndexDB(config.indexedDBPath);

// init worldStateDBLazy
const existDBLazy = fs.existsSync(config.worldStateDBLazyPath);// must check ahead of connecting levelDB!
const worldStateDBLazy = new WorldStateDB(config.worldStateDBLazyPath);
if (!existDBLazy) {
    logger.info(`worldStateDBLazyPath is not existing`)
    await worldStateDBLazy.initTrees();
    logger.info(`worldStateDBLazy.initTrees done.`);
} else {
    await worldStateDBLazy.loadTrees();
    logger.info(`worldStateDBLazy.loadTrees done.`);
}

const connection = getConnection();
const blockRepository = await connection.getRepository(Block);
let latestBlock: Block = undefined as any;

// init worldStateDB
const existDB = fs.existsSync(config.worldStateDBPath);// must check ahead of connecting levelDB!
const worldStateDB = new WorldStateDB(config.worldStateDBPath);
if (!existDB) {
    logger.info(`worldStateDBPath is not existing`)

    if (config.networkStatus != 'SIMULATING_PRODUCTION') {// if dev are simulating production to make issues debug, then no need resetDB.
        // reset mysql db
        await rollupDB.resetDB();
    }
    await worldStateDB.initTrees();
    logger.info(`worldStateDB.initTrees done.`);

    // prepare data_tree root into indexDB & dataTreeRootsTree
    const dataTreeRoot = worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false);
    logger.info(`the initial dataTreeRoot: ${dataTreeRoot.toString()}`);
    const index = worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);// 0n
    await worldStateDB.appendLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, [dataTreeRoot]);
    await worldStateDB.commit();
    logger.info(`append the initial dataTreeRoot into DATA_TREE_ROOTS_TREE at index:${index}, done.`);
    await indexDB.put(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${dataTreeRoot.toString()}`, `${index.toString()}`);// '0'

} else {
    await worldStateDB.loadTrees();
    logger.info(`worldStateDB.loadTrees done.`);

        // query latest block
        latestBlock = (await blockRepository.find({
            order: {
                id: 'DESC'
            },
            take: 1
        }))[0];
}


// take a check if the trees are aligned with mysqlDB, if not then sync them now.
if (latestBlock) {// skip some existing blocks!
    const latestBlockIdInIndexDB: number = await indexDB.get('LATESTBLOCK');

    // During rollup-seq, indexDB stores 'LATESTBLOCK' after committing worldState, 
    //   thus all merkle trees of the blocks ahead of latestBlockIdInIndexDB has been synced already.
    if (latestBlockIdInIndexDB < latestBlock.id) {// less then 
        logger.info(`latestBlockId(${latestBlockIdInIndexDB}) in IndexDB is less than MysqlDB.latestBlock.id(${latestBlock.id})`);
        logger.info(`start syncing trees...`);
        const blockCacheRepo = await connection.getRepository(BlockCache);

        logger.info(`start sync DATA_TREE...`);
        // calc which block's dataTreeRoot0 == data_tree root
        const dataTreeRoot = worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false).toString();
        logger.info(`DATA_TREE's root is ${dataTreeRoot}`);

        const block0 = (await blockRepository.findOne({
            where: {
                dataTreeRoot1: dataTreeRoot
            }
        }));
        if (!block0) {
            logger.error(`cannot find the target block by DATA_TREE's root`);

            throw new Error("sync DATA_TREE failed when restart network!!");
        }
        for (let index = block0.id + 1; index <= latestBlock.id; index++) {
            logger.info(`sync DATA_TREE at blockId=${index}`);

            const cache0 = await blockCacheRepo.findOne({
                where: {
                    blockId: index,
                    type: BlockCacheType.DATA_TREE_UPDATES
                }
            });
            if (!cache0) {
                logger.info(`cannot find blockCache!`);

                throw new Error("sync DATA_TREE failed when restart network: blockCache is undefined");
            }
            if (!cache0.cache || cache0.cache == '[]') {
                logger.info(`blockCache.cache is ${cache0.cache} !`);

                throw new Error("sync DATA_TREE failed when restart network: blockCache.cache is []");
            }
            const cachedUpdatesDataTree = (JSON.parse(cache0!.cache) as string[]).map(c => Field(c));
            await worldStateDB.appendLeaves(MerkleTreeId.DATA_TREE, cachedUpdatesDataTree);
            await worldStateDB.commit();

            logger.info(`sync DATA_TREE at blockId=${index}, done.`);
        }
        logger.info(`sync DATA_TREE done.`);

        
        logger.info(`start sync NULLIFIER_TREE...`);
        // calc which block's nullifierTreeRoot0 == nullifier_tree root
        const nullifierTreeRoot = worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, false).toString();
        logger.info(`NULLIFIER_TREE's root is ${dataTreeRoot}`);

        const block1 = (await blockRepository.findOne({
            where: {
                nullifierTreeRoot1: nullifierTreeRoot
            }
        }));
        if (!block1) {
            logger.error(`cannot find the target block by NULLIFIER_TREE's root`);

            throw new Error("sync NULLIFIER_TREE failed when restart network!!");
        }
        for (let index = block1.id + 1; index <= latestBlock.id; index++) {
            logger.info(`sync NULLIFIER_TREE at blockId=${index}`);

            const cache1 = await blockCacheRepo.findOne({
                where: {
                    blockId: index,
                    type: BlockCacheType.NULLIFIER_TREE_UPDATES
                }
            });
            if (!cache1) {
                logger.info(`cannot find blockCache!`);

                throw new Error("sync NULLIFIER_TREE failed when restart network: blockCache is undefined");
            }
            const cachedUpdatesNullifierTree = (JSON.parse(cache1!.cache) as string[]).map(c => Field(c));
            await worldStateDB.appendLeaves(MerkleTreeId.NULLIFIER_TREE, cachedUpdatesNullifierTree);
            await worldStateDB.commit();

            logger.info(`sync NULLIFIER_TREE at blockId=${index}, done.`);
        }
        logger.info(`sync NULLIFIER_TREE done.`);

        
        logger.info(`start sync DATA_TREE_ROOTS_TREE...`);
        // calc which block's rootTreeRoot0 == root_tree root
        const rootTreeRoot = worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false).toString();
        logger.info(`DATA_TREE_ROOTS_TREE's root is ${dataTreeRoot}`);
        const block2 = (await blockRepository.findOne({
            where: {
                rootTreeRoot1: rootTreeRoot
            }
        }));
        if (!block2) {
            logger.error(`cannot find the target block by DATA_TREE_ROOTS_TREE's root`);

            throw new Error("sync DATA_TREE_ROOTS_TREE failed when restart network!!");
        }
        for (let index = block2.id + 1; index <= latestBlock.id; index++) {
            logger.info(`sync DATA_TREE_ROOTS_TREE at blockId=${index}`);

            const cache2 = await blockCacheRepo.findOne({
                where: {
                    blockId: index,
                    type: BlockCacheType.DATA_TREE_ROOTS_TREE_UPDATES
                }
            });
            if (!cache2) {
                logger.info(`cannot find blockCache!`);

                throw new Error("sync DATA_TREE_ROOTS_TREE failed when restart network: blockCache is undefined");
            }
            if (!cache2.cache || cache2.cache == '[]') {
                logger.info(`blockCache.cache is ${cache2.cache} !`);

                throw new Error("sync DATA_TREE_ROOTS_TREE failed when restart network: blockCache.cache is []");
            }
            const cachedUpdatesRootTree = (JSON.parse(cache2.cache) as string[]).map(c => Field(c));
            await worldStateDB.appendLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, cachedUpdatesRootTree);
            await worldStateDB.commit();

            logger.info(`sync DATA_TREE_ROOTS_TREE at blockId=${index}, done.`);
        }
        logger.info(`sync DATA_TREE_ROOTS_TREE done.`);

    }
}

// construct WorldState
const worldState = new WorldState(worldStateDBLazy, worldStateDB, rollupDB, indexDB);
const withdrawDB = new WithdrawDB(config.withdrawDBPath);


export const queryTxByNullifier = async (dto: string[]) => {
    const notehashes = dto;

    const connection = getConnection();

    try {
        // query confirmed tx
        const txRepository = connection.getRepository(L2Tx);
        let l2TxListNullifier1 = await txRepository.find({
            where: {
                nullifier1: In(notehashes)
            }
        }) ?? [];

        let l2TxListNullifier2 = await txRepository.find({
            where: {
                nullifier2: In(notehashes)
            }
        }) ?? [];

        let l2TxList = l2TxListNullifier1.concat(l2TxListNullifier2);
        const map = new Map();
        l2TxList.forEach(e => {
            map.set(e.txHash, e);
        });

        const result = Array.from(map.values());

        return {
            code: 0,
            data: result,
            msg: ''
        };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}


export const withdrawAsset = async (  dto: WithdrawAssetReqDto) => {
    const { l1addr, noteCommitment } = dto
    try {
        const connection = getConnection();
        const withdrawInfoRepository = connection.getRepository(WithdrawInfo);
        const winfo = (await withdrawInfoRepository.findOne({
            where: {
                outputNoteCommitment: noteCommitment,
                ownerPk: l1addr,
                status: WithdrawNoteStatus.PENDING
            }
        }))!

        // check if it's the first withdraw
        let tokenId = winfo.assetId;
        const { accountExists, account } = await checkAccountExists(PublicKey.fromBase58(l1addr), Field(tokenId));

        const notFirst = !accountExists && account.zkapp?.appState[0] == Field(0);

        if (notFirst) {//if it's NOT the first withdraw
            // loadTree from withdrawDB & obtain merkle witness
            await withdrawDB.loadTree(PublicKey.fromBase58(l1addr), winfo.assetId);

        } else {// first withdraw
            // init a 'USER_NULLIFIER_TREE' tree for it
            await withdrawDB.initTree(PublicKey.fromBase58(l1addr), winfo.assetId);
        }

        let initialCP = await checkPoint();// return the latest confirmed Block Height!

        const withdrawNote = winfo.valueNote();
        const index = winfo.outputNoteCommitmentIdx;
        const dataMerkleWitness = await worldState.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE,
            BigInt(winfo.outputNoteCommitmentIdx), false);

        const withdrawNoteWitnessData: WithdrawNoteWitnessData =
            WithdrawNoteWitnessData.fromJSON({
                withdrawNote,
                index,
                witness: dataMerkleWitness
            });

        const { index: preIdx, alreadyPresent } = await withdrawDB.findIndexOfPreviousValue(Field(winfo.outputNoteCommitment), true);
        const preLeafData = await withdrawDB.getLatestLeafDataCopy(preIdx, true);
        // alreadyPresent must be true at this stage
        const lowLeafWitness = LowLeafWitnessData.fromJSON({
            leafData: {
                value: preLeafData!.value.toString(),
                nextIndex: preLeafData!.nextIndex.toString(),
                nextValue: preLeafData!.nextValue.toString()
            },
            siblingPath: await withdrawDB.getSiblingPath(BigInt(preIdx), true),
            index: Field(preIdx).toString()
        });

        const oldNullWitness: NullifierMerkleWitness = await withdrawDB.getSiblingPath(withdrawDB.getNumLeaves(true), true)

        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<{ withdrawInfoId: number }, any> = {
            taskType: ProofTaskType.USER_FIRST_WITHDRAW,
            index: { withdrawInfoId: winfo.id },
            payload: {
                withdrawNoteWitnessData,
                lowLeafWitness,
                oldNullWitness
            }
        }

        if (!notFirst) {// first withdraw, need vk for deploy contract
            //const verificationKey: VerificationKey = config.withdrawAccountVK;
            //proofTaskDto.payload.verificationKey = verificationKey;
        } else {
            proofTaskDto.taskType = ProofTaskType.USER_WITHDRAW
        }

        // CHECKPOINT: check if this flow is outdated
        if (initialCP != await checkPoint()) {
            return {
                code: 1,
                data: 'failed: rollup begins!',
                msg: ''
            };
        }

        // send to proof-generator for circuit exec
        let rs = await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            return r.data;
        });
        if (rs.code == 1) {
            return {
                code: 1,
                data: 'failed: proof-generate error!',
                msg: ''
            };
        }

        // update status to 'PROCESSING' to avoid double computation triggered by user in a short time before the previous proof back.
        winfo!.status = WithdrawNoteStatus.PROCESSING;
        winfo.blockIdWhenL1Tx = initialCP;
        withdrawInfoRepository.save(winfo);

        return {
            code: 0,
            data: '',
            msg: 'processing'
        };

    } catch (err) {
        // roll back withdrawDB
        withdrawDB.rollback();

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    } finally {
        withdrawDB.reset();
    }
}


/**
 * during the entire WITHDRAWAL flow, need ganruantee being under the same data_tree root.
 */
export async function checkPoint() {
    // query current latest block height
    const blockRepository = getConnection().getRepository(Block);
    // query latest block
    const blockEntity = (await blockRepository.find({
        select: [
            'id'
        ],
        where: {
            status: BlockStatus.CONFIRMED
        },
        order: {
            id: 'DESC'
        },
        take: 1
    }))[0];

    return blockEntity!.id;
}

export async function proofCallback(  dto: ProofTaskDto<any, any>) {

    const { taskType, index, payload } = dto

    if (taskType == ProofTaskType.ROLLUP_FLOW) {

        process.send!(dto);

    } else {// FIRST_WITHDRAW || WITHDRAW
        const connection = getConnection();
        const withdrawInfoRepository = connection.getRepository(WithdrawInfo)
        try {
            const withdrawInfo = (await withdrawInfoRepository.findOne({
                where: {
                    id: index.withdrawInfoId
                }
            }))!;

            // query current latest block height
            const blockRepository = connection.getRepository(Block);
            // query latest block
            const blockEntity = (await blockRepository.find({
                select: [
                    'id'
                ],
                order: {
                    id: 'DESC'
                },
                take: 1
            }))[0];
            const currentBlockHeight = blockEntity.id;

            if (withdrawInfo.blockIdWhenL1Tx != currentBlockHeight) {// outdated, should revert status!
                withdrawInfo.status = WithdrawNoteStatus.PENDING;

                // loadTree from withdrawDB & obtain merkle witness
                await withdrawDB.loadTree(PublicKey.fromBase58(withdrawInfo.ownerPk), withdrawInfo.assetId);// the tree must be in cache now!
                await withdrawDB.rollback();// rollup it!
                withdrawDB.reset();// the total flow is ended.
            } else {
                withdrawInfo.l1TxBody = JSON.stringify(payload);
                // withdrawInfo?.l1TxHash = payload.   // TODO how to pre_calc tx.id??
            }

            // save l1TxBody
            await withdrawInfoRepository.save(withdrawInfo);

        } catch (err) {
            // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
        }
    }

    return {
        code: 0,
        data: '',
        msg: 'in queue'
    };
}



export async function rollupProofTrigger(dto: RollupTaskDto<any, any>) {
    try {
        // forward it to main process, and will further forward it to Rollup processes.
        process.send!(dto)

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function triggerStartNewFlow() {
    try {
        // start a new flow! 
        await worldState.startNewFlow();

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function checkCommitmentsExist( commitmentList: string[]) {
    try {
        const rs = Object.fromEntries(
            await Promise.all(commitmentList.map(async c => {
                return [c, String(await worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${c}`) ?? '')];
            }))
        )

        return { code: 0, data: rs, msg: '' };
    } catch (err) {
        console.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}


export async function checkDataRootsExist( commitmentList: string[]) {

    try {
        const rs = Object.fromEntries(
            await Promise.all(commitmentList.map(async c => {
                return [c, String(await worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${c}`) ?? '')];
            }))
        )

        return { code: 0, data: rs, msg: '' };
    } catch (err) {
        console.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function checkNullifiersExist( nullifierList: string[]) {

    try {

        const rs = Object.fromEntries(
            await Promise.all(
                nullifierList.map(async n => {
                    return [n, String(await worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${n}`) ?? '')]
                })
            )
        )

        return { code: 0, data: rs, msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function syncUserWithdrawedNotes() {
    logger.info(`a new round to sync withdrawed notes inside WithdrawEventFetchRecord...`);

    const connection = getConnection();

    const recordList = await connection.getRepository(WithdrawEventFetchRecord).find({
        where: {
            status: WithdrawEventFetchRecordStatus.NOT_SYNC
        }
    }) ?? [];

    if (recordList.length == 0) {
        logger.warn(`no new NOT_SYNC record, end.`);

        return { code: 0, data: 0, msg: '' }
    }

    logger.info(`NOT_SYNC recordList: ${JSON.stringify(recordList.map(r => r.id))}`);

    for (let i = 0; i < recordList.length; i++) {
        const record = recordList[i];
        logger.info(`start processing record[${record.id}...]`);

        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();
        try {
            const wIdList0: number[] = JSON.parse(record.data0);
            const withdrawNoteInfoList = await queryRunner.manager.find(WithdrawInfo, {
                where: {
                    id: In([wIdList0])
                }
            }) ?? [];

            const withdrawNoteInfoMap = new Map<string, WithdrawInfo[]>();
            withdrawNoteInfoList.forEach(w => {
                const wInfoList: WithdrawInfo[] = withdrawNoteInfoMap.get(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${w.assetId}:${w.ownerPk}`) ?? [];
                wInfoList.push(w);
                withdrawNoteInfoMap.set(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${w.assetId}:${w.ownerPk}`, wInfoList);
            });

            const wIdList_syncFailed: number[] = [];
            const wIdList_synced: number[] = [];
            for (let [key, wInfoListX] of withdrawNoteInfoMap) {
                const assetId = key.split(':')[1];
                const ownerPk = key.split(':')[2];

                const wInfo0 = wInfoListX[0];
                try {
                    logger.info(`loading tree: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${ownerPk} ...`);
                    // loadTree from withdrawDB & obtain merkle witness
                    await withdrawDB.loadTree(PublicKey.fromBase58(ownerPk), assetId);
                    logger.info(`load tree, done.`);

                    wInfoListX.sort((a, b) => {// from small to bigger
                        return Number(a.nullifierIdx) - Number(b.nullifierIdx)
                    });
                    logger.info(`need to sync withdrawNoteInfoList: ${JSON.stringify(wInfoListX.map(v => v.id))}`);

                    // check if the first nullifierTreeRoot0 is aligned
                    if (wInfo0.nullifierTreeRoot0 != withdrawDB.getRoot(false).toString()) {
                        console.error(`withdrawNoteInfo[${wInfo0.id}]'s nullifierTreeRoot0 != current root of ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${ownerPk}`);
                        logger.error(`withdrawNoteInfo[${wInfo0.id}]'s nullifierTreeRoot0 != current root of ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${ownerPk}`);

                        throw new Error(`root check failed!`);
                    }

                    // check the order before insert
                    wInfoListX.reduce((p, c) => {
                        if (wInfo0 == p) {
                            return wInfo0;
                        }
                        if (Number(p.nullifierIdx) + 1 != Number(c.nullifierIdx)) {
                            console.error(`withdrawNoteInfo[${c.id}]'s nullifierIdx[${c.nullifierIdx}] break the index order`);
                            logger.error(`withdrawNoteInfo[${c.id}]'s nullifierIdx[${c.nullifierIdx}] break the index order`);

                            throw new Error(`nullifierIdx break order!`);
                        }
                        return c;
                    }, wInfo0);

                    logger.info(`nullifierIdx from ${wInfo0.nullifierIdx} to ${wInfoListX[wInfoListX.length - 1].nullifierIdx}`);
                    const commitments = wInfoListX.map(v => {
                        return Field(v.outputNoteCommitment);
                    });
                    await withdrawDB.appendLeaves(commitments);

                    await withdrawDB.commit();
                    logger.info(`sync tree[${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${assetId}:${ownerPk}], done.`);

                    wIdList_synced.push(wInfo0.id);
                } catch (err) {
                    logger.error(err);

                    wIdList_syncFailed.push(wInfo0.id);
                } finally {
                    await withdrawDB.reset();//!!
                }
            }

            record.data0 = JSON.stringify(wIdList_syncFailed);
            logger.warn(`wIdList_syncFailed at record[id=${record.id}]: ${record.data0}`);
            record.data1 = JSON.stringify(wIdList_synced);
            logger.warn(`wIdList_synced at record[id=${record.id}]: ${record.data1}`);
            if (wIdList_syncFailed.length == 0) {
                record.status = WithdrawEventFetchRecordStatus.SYNCED;
                logger.warn(`update record[id=${record.id}]: SYNCED`);
            }
            await queryRunner.manager.save(record);

            await queryRunner.commitTransaction();
        } catch (err) {
            logger.error(err);
            console.error(err);

            await queryRunner.rollbackTransaction();

            return { code: 1, data: 0, msg: '' };
        } finally {
            await queryRunner.release();

            logger.info(`process record[${record.id}, done.]`);
        }
    }
    logger.info(`this round end.`);

    return { code: 0, data: 1, msg: '' };
}

export async function queryWorldStateworldState() {
    try {
        // query sequencer
        return {
            code: 0, data: {
                syncDataTree: {
                    totalNum: worldState.worldStateDBLazy.getNumLeaves(MerkleTreeId.DATA_TREE, false).toString(),
                    root: worldState.worldStateDBLazy.getRoot(MerkleTreeId.DATA_TREE, false).toString()
                },
                dataTree: {
                    totalNum: worldState.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, false).toString(),
                    root: worldState.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false).toString()
                },
                nullifierTree: {
                    totalNum: worldState.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, false).toString(),
                    root: worldState.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, false).toString()
                },
                rootTree: {
                    totalNum: worldState.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, false).toString(),
                    root: worldState.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false).toString()
                },
            }, msg: ''
        };

    } catch (err) {
        console.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryNetworkMetaData() {
    try {
        // query sequencer
        return {
            code: 0, data: {
                rollupContractAddress: config.rollupContractAddress,
                depositContractAddress: config.entryContractAddress,
                vaultContractAddress: config.vaultContractAddress,
                dataTreeHeight: DATA_TREE_HEIGHT,
                nullifierTreeHeight: NULLIFIER_TREE_HEIGHT,
                rootTreeHeight: ROOT_TREE_HEIGHT,
                withdrawTreeHeight: NULLIFIER_TREE_HEIGHT,

            }, msg: ''
        };

    } catch (err) {
        console.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function appendTreeByHand( dto: { passcode: string, timestamp: number, treeId: number, leaves: string[] }) {
    const { passcode, timestamp, treeId, leaves } = dto;
    if (passcode != 'LzxWxs@2023') {
        return {
            code: 0,
            data: undefined as any,
            msg: 'passcode error!'
        }
    }

    if ((new Date().getTime() - timestamp) > 1 * 60 * 1000) {
        return {
            code: 0,
            data: undefined as any,
            msg: 'request out of date!'
        }
    }


    const worldStateDBTmp = treeId == MerkleTreeId.SYNC_DATA_TREE ? worldState.worldStateDBLazy : worldState.worldStateDB;

    const treeName = MerkleTreeId[treeId];
    try {
        const includeUncommit = false;

        // print tree info
        logger.info(`print tree before append:`);
        logger.info(`  treeId: ${treeId}`);
        logger.info(`  treeName: ${treeName}`);
        logger.info(`  depth: ${worldStateDBTmp.getDepth(treeId)}`);
        logger.info(`  leafNum: ${worldStateDBTmp.getNumLeaves(treeId, includeUncommit).toString()}`);
        logger.info(`  treeRoot: ${worldStateDBTmp.getRoot(treeId, includeUncommit).toString()}`);

        await worldStateDBTmp.appendLeaves(treeId, leaves.map(l => Field(l)));
        await worldStateDBTmp.commit();

        let depth = worldStateDBTmp.getDepth(treeId);
        let leafNum = worldStateDBTmp.getNumLeaves(treeId, includeUncommit).toString();
        let treeRoot = worldStateDBTmp.getRoot(treeId, includeUncommit).toString();

        // print tree info
        logger.info(`print tree after append:`);
        logger.info(`  treeId: ${treeId}`);
        logger.info(`  treeName: ${treeName}`);
        logger.info(`  depth: ${depth}`);
        logger.info(`  leafNum: ${leafNum}`);
        logger.info(`  treeRoot: ${treeRoot}`);

        return {
            code: 0,
            data: {
                treeId,
                treeName,
                depth,
                leafNum,
                treeRoot
            }, msg: ''
        };
    } catch (err) {
        logger.error(err);
        console.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function appendUserNullifierTreeByHand( dto: { passcode: string, timestamp: number, tokenId: string, ownerPk: string, leaves: string[] }) {
    const { passcode, timestamp, tokenId, ownerPk, leaves } = dto;
    if (passcode != 'LzxWxs@2023') {
        return {
            code: 0,
            data: undefined as any,
            msg: 'passcode error!'
        }
    }

    if ((new Date().getTime() - timestamp) > 1 * 60 * 1000) {
        return {
            code: 0,
            data: undefined as any,
            msg: 'request out of date!'
        }
    }

    try {
        const firstFlag = await worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:STATUS:${ownerPk}:${tokenId}`);
        logger.info(`check if already init: firstFlag=${firstFlag?.toString()}`);
        if (!firstFlag) {
            return {
                code: 0,
                data: undefined as any,
                msg: 'the tree is not init yet!'
            }
        }

        logger.info(`loading tree: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk} ...`);
        // loadTree from withdrawDB & obtain merkle witness
        await withdrawDB.loadTree(PublicKey.fromBase58(ownerPk), tokenId);
        logger.info(`load tree, done.`);

        const includeUncommit = false;

        // print tree info
        logger.info(`print withdraw tree before append:`);
        logger.info(`  treeId: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk}`);
        logger.info(`  depth: ${withdrawDB.getDepth()}`);
        logger.info(`  leafNum: ${withdrawDB.getNumLeaves(includeUncommit).toString()}`);
        logger.info(`  treeRoot: ${withdrawDB.getRoot(includeUncommit).toString()}`);

        await withdrawDB.appendLeaves(leaves.map(l => Field(l)));
        await withdrawDB.commit();

        let depth = withdrawDB.getDepth();
        let leafNum = withdrawDB.getNumLeaves(includeUncommit).toString();
        let treeRoot = withdrawDB.getRoot(includeUncommit).toString();

        // print tree info
        logger.info(`print withdraw tree after append:`);
        logger.info(`  treeId: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk}`);
        logger.info(`  depth: ${withdrawDB.getDepth()}`);
        logger.info(`  leafNum: ${withdrawDB.getNumLeaves(includeUncommit).toString()}`);
        logger.info(`  treeRoot: ${withdrawDB.getRoot(includeUncommit).toString()}`);

        await withdrawDB.reset();

        return {
            code: 0,
            data: {
                treeId: `${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk}`,
                depth,
                leafNum,
                treeRoot
            }, msg: ''
        };
    } catch (err) {
        logger.error(err);
        console.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryMerkleProof( dto: { treeId: number, commitmentList: string[] }) {
    const { treeId, commitmentList } = dto

    try {
        const merkleProofDtoList: any[] = [];

        for (let i = 0; i < commitmentList.length; i++) {
            const commitment = commitmentList[i];

            // DATA_TREE:{comitment} -> leafIndex
            let leafIndex = String(await worldState.indexDB.get(`${MerkleTreeId[treeId]}:${commitment}`) ?? '');

            if (leafIndex) {
                const siblingPath = await worldState.worldStateDB.getSiblingPath(treeId, BigInt(leafIndex), false);

                merkleProofDtoList.push({
                    leafIndex: Number(leafIndex),
                    commitment: commitment,
                    paths: siblingPath.path.map(p => { return p.toString(); })
                } as MerkleProofDto
                );
            }
        }

        return { code: 0, data: merkleProofDtoList, msg: '' };
    } catch (err) {
        console.error(err);

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryUserTreeInfo(  dto: { tokenId: string, ownerPk: string, includeUncommit: boolean }) {
    const { tokenId, ownerPk, includeUncommit } = dto;

    try {
        const firstFlag = await worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:STATUS:${ownerPk}:${tokenId}`);
        logger.info(`check if already init: firstFlag=${firstFlag?.toString()}`);
        if (!firstFlag) {
            return {
                code: 0,
                data: undefined as any,
                msg: 'the tree is not init yet!'
            }
        }

        logger.info(`loading tree: ${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk} ...`);
        // loadTree from withdrawDB & obtain merkle witness
        await withdrawDB.loadTree(PublicKey.fromBase58(ownerPk), tokenId);
        logger.info(`load tree, done.`);

        const depth = withdrawDB.getDepth();
        const leafNum = withdrawDB.getNumLeaves(includeUncommit).toString();
        const treeRoot = withdrawDB.getRoot(includeUncommit).toString();
        await withdrawDB.reset();
        logger.info(`withdrawDB.reset... done.`);

        return {
            code: 0,
            data: {
                treeId: `${MerkleTreeId[MerkleTreeId.USER_NULLIFIER_TREE]}:${tokenId}:${ownerPk}`,
                includeUncommit,
                depth,
                leafNum,
                treeRoot
            }, msg: ''
        };
    } catch (err) {
        logger.error(err);
        console.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

async function queryTxByNoteHashes(noteHashes: string[]){
    const notehashes = req.body;

    const connection = getConnection();

    try {
        // query confirmed tx
        const txRepository = connection.getRepository(L2Tx);
        let l2TxListNoteCommitment1 = await txRepository.find({
            where: {
                outputNoteCommitment1: In(notehashes)
            }
        }) ?? [];

        let l2TxListNoteCommitment2 = await txRepository.find({
            where: {
                outputNoteCommitment2: In(notehashes)
            }
        }) ?? [];

        let l2TxList = l2TxListNoteCommitment1.concat(l2TxListNoteCommitment2);
        const map = new Map();
        l2TxList.forEach(e => {
            map.set(e.txHash, e);
        });

        const result = Array.from(map.values());

        return {
            code: 0,
            data: result,
            msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}
