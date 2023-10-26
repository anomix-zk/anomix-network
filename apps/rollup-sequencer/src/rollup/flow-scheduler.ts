
import config from "@/lib/config";
import { DepositStatus, MerkleTreeId, L2TxStatus, PoseidonHasher, MerkleProofDto, BlockCacheType, BaseResponse, BlockStatus, WithdrawNoteStatus, BaseSiblingPath } from "@anomix/types";
import {
    DataMerkleWitness, DataRootWitnessData, LowLeafWitnessData, NullifierMerkleWitness,
    DUMMY_FIELD, AnomixEntryContract, AnomixRollupContract, ActionType, NoteType, ValueNote, Commitment, RollupState, RollupStateTransition, BlockProveOutput, TxFee, FEE_ASSET_ID_SUPPORT_NUM, AssetId, DEPOSIT_TREE_INIT_ROOT
} from "@anomix/circuits";
import { WorldStateDB, WorldState, IndexDB, RollupDB } from "@/worldstate";
import { Block, BlockCache, DepositCommitment, InnerRollupBatch, L2Tx, MemPlL2Tx, WithdrawInfo } from "@anomix/dao";
import { Field, PublicKey, PrivateKey, Poseidon, UInt64, Provable } from 'o1js';
import { syncAcctInfo, uint8ArrayToBase64String } from "@anomix/utils";
import { getConnection, In } from "typeorm";
import { assert } from "console";
import { getLogger } from "@/lib/logUtils";
import { randomBytes, randomInt, randomUUID } from "crypto";
import { $axiosDepositProcessor } from "@/lib";
import { LeafData } from "@anomix/merkle-tree";
import { BlockCacheStatus } from "@anomix/types";
import fs from "fs";
import { getDateString } from "@/lib/timeUtils";

const logger = getLogger('FlowScheduler');

export class FlowScheduler {
    private depositStartIndexInBlock: Field
    private depositTreeRootInBlock: Field
    private depositEndIndexInBlock: Field

    private currentRootTreeRoot: Field
    private currentDataRoot: Field
    private currentNullifierRoot: Field

    private targetRootTreeRoot: Field
    private targetDataRoot: Field
    private targetNullifierRoot: Field

    constructor(private worldState: WorldState, private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) { }

    private async init() {
        // TODO clear dirty data on both rollupDB & worldStateDB
        await this.worldStateDB.rollback();

        // fetch from contract
        const entryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
        // const rollupContractAddr = PublicKey.fromBase58(config.rollupContractAddress);
        await syncAcctInfo(entryContractAddr);
        // await syncAcctInfo(rollupContractAddr);

        // const rollupContract = new AnomixRollupContract(rollupContractAddr);// not based on onchain values, but last block's result!
        this.currentDataRoot = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false);
        logger.info(`currentDataRoot: ${this.currentDataRoot}`);
        this.currentRootTreeRoot = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);
        logger.info(`currentRootTreeRoot: ${this.currentRootTreeRoot}`);
        this.currentNullifierRoot = this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, false);
        logger.info(`currentNullifierRoot: ${this.currentNullifierRoot}`);

        const entryContract = new AnomixEntryContract(entryContractAddr);
        // this.depositStartIndexInBlock = rollupContract.state.get().depositStartIndex;
        this.depositTreeRootInBlock = entryContract.depositState.get().depositRoot;
        logger.info(`init depositTreeRootInBlock to currently onchain entryContract.depositState: ${this.depositTreeRootInBlock}`);

    }

    async start() {
        logger.info(`start a new round of rollup-seq...`);
        // clear dirty data on both rollupDB & worldStateDB at the beginning
        await this.init();

        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();
        try {
            const innerRollupTxNum = config.innerRollup.txCount;

            // query unhandled NON-Deposit Tx list from RollupDB
            let mpTxList = await queryRunner.manager.find(MemPlL2Tx, {
                where: {
                    status: L2TxStatus.PENDING,
                },
                order: { txFee: 'DESC' }
            }) ?? [];
            if (mpTxList.length == 0) {
                logger.info('no tx inside mempool...');

                await queryRunner.rollbackTransaction();
                await this.worldState.reset();//  end this flow!
                logger.info('reset worldState.');
                logger.info('end.');

                return;
            }

            const existingLatestBlock = (await queryRunner.manager.find(Block, {
                order: {
                    id: 'DESC'
                },
                take: 1
            }))[0];
            let existingLatestBlockId = 0;
            if (existingLatestBlock) {// if exist
                existingLatestBlockId = existingLatestBlock.id;

                let checkRs = true;
                // check dataTreeRoot is aligned 
                if (existingLatestBlock.dataTreeRoot1 != this.currentDataRoot.toString()) {
                    logger.warn(`existingLatestBlock.dataTreeRoot1[${existingLatestBlock.dataTreeRoot1}] != this.currentDataRoot`);
                    checkRs &&= false;
                }
                // check nullifierTreeRoot is aligned 
                if (existingLatestBlock.nullifierTreeRoot1 != this.currentNullifierRoot.toString()) {
                    logger.warn(`existingLatestBlock.nullifierTreeRoot1[${existingLatestBlock.nullifierTreeRoot1}] != this.currentNullifierRoot`);
                    checkRs &&= false;
                }
                // check rootTreeRoot is aligned 
                if (existingLatestBlock.rootTreeRoot1 != this.currentRootTreeRoot.toString()) {
                    logger.warn(`existingLatestBlock.rootTreeRoot1[${existingLatestBlock.rootTreeRoot1}] != this.currentRootTreeRoot`);
                    checkRs &&= false;
                }

                if (!checkRs) {
                    logger.error('merkle tree is inconsistent! pls ping administrator...');

                    await queryRunner.rollbackTransaction();
                    await this.worldState.reset();//  end this flow!
                    logger.info('reset worldState.');
                    logger.info('end.');

                    return;
                }
            }

            const currentBlockId = existingLatestBlockId + 1;
            logger.info(`start generating block: ${currentBlockId}...`);

            // snapshot the leaves of nullifier_tree before appendLeaves
            logger.info(`snapshot nullifier_tree's leaves before appendLeaves...`);
            const snapshotLeavesBeforeBlockGen = this.worldStateDB.exportNullifierTreeForDebug();
            const fileName = `/opt/private-anomix-network-data/treesnapshots/block-${currentBlockId}-nullifier-tree-pre-snapshot-${getDateString()}`;
            fs.writeFile(fileName, snapshotLeavesBeforeBlockGen, (err) => {
                if (err) {
                    logger.error(`${fileName} persist error!`);
                    logger.error(err);
                } else {
                    logger.info(`${fileName} written successfully`);
                }
            });
            logger.info(`async persist nullifier_tree's leaves at ${fileName} ...`);

            // based on last block's depositStartIndex1, if no last block, then set '0'
            this.depositStartIndexInBlock = Field((await queryRunner.manager.find(Block, {
                order: {
                    id: 'DESC'
                },
                take: 1
            }))[0]?.depositStartIndex1 ?? '0');
            logger.info(`depositStartIndexInBlock: ${this.depositStartIndexInBlock}...`);

            // ================== below: mpTxList.length > 0 ==================
            // !!need double check if nullifier1/2 has already been spent!!
            const ridTxList: MemPlL2Tx[] = [];
            const promises: Promise<any>[] = [];
            mpTxList.forEach(tx => {
                promises.push((async () => {
                    if (tx.actionType == ActionType.DEPOSIT.toString()) {// exclude Account?
                        return;
                    }
                    const index1 = String(await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${tx.nullifier1}`) ?? '');
                    const index2 = String(await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${tx.nullifier2}`) ?? '');
                    if (index1 != '' || index2 != '') {
                        ridTxList.push(tx);
                    }
                })());
            });
            await Promise.all(promises);

            if (ridTxList.length > 0) {
                ridTxList.forEach(tx => {
                    mpTxList.splice(mpTxList.indexOf(tx), 1);
                    tx.status = L2TxStatus.FAILED;
                });
                await queryRunner.manager.save(ridTxList);
            }
            logger.info(`ridTxList whose nullifier1/2 is spent already: ${ridTxList.map(r => r.txHash)}`);

            // !!need double check if nullifier1/2 has already been spent!!
            mpTxList = await this.ridLessFeeOnesIfDoubleSpend(mpTxList);
            logger.info(`after ridLessFeeOnesIfDoubleSpend, mpTxList.length == ${mpTxList.length}`);
            if (mpTxList.length == 0) {
                await this.worldState.reset();//  end this flow!
                logger.info(`end.`);
                return;
            }

            // to avoid expected random seq of depositTxList, suggest to sort depositTx within mpTxList
            const nonDepositTxList = mpTxList.filter(tx => {
                return tx.actionType != ActionType.DEPOSIT.toString();
            })
            logger.info(`nonDepositTxList number: ${nonDepositTxList.length}`);
            const depositTxList = mpTxList.filter(tx => {
                return tx.actionType == ActionType.DEPOSIT.toString();
            }).sort((a, b) => {
                return Number(a.depositIndex) - Number(b.depositIndex);
            });
            logger.info(`depositTxList number: ${depositTxList.length}`);
            mpTxList = [...nonDepositTxList, ...depositTxList];

            const depositCount = depositTxList.length;
            this.depositEndIndexInBlock = this.depositStartIndexInBlock.add(depositCount);
            logger.info(`depositEndIndexInBlock: ${this.depositEndIndexInBlock}`);

            let blockCachedWitnessDc: BlockCache = undefined as any;
            if (depositCount > 0) {
                //  coordinator has already stopped Broadcasting DepositRollupProof as L1Tx.
                const dcWitnessWrapper = await $axiosDepositProcessor.post<BaseResponse<{
                    treeId: number,
                    treeRoot: string,
                    witnesses: any[][]
                }>>('/merkle-witness', {
                    treeId: MerkleTreeId.DEPOSIT_TREE,
                    leafIndexList: depositTxList.map(d => d.depositIndex)
                }).then(r => {
                    if (r.data.code == 1) {
                        logger.error(`could not obtain latest DEPOSIT_TREE root: ${r.data.msg}`);
                        throw new Error(`could not obtain latest DEPOSIT_TREE root: ${r.data.msg}`);
                    }

                    return r.data.data!;
                });
                this.depositTreeRootInBlock = Field(dcWitnessWrapper.treeRoot);

                // pre fill with the latest depositTreeRoot and currently dataTreeRoot
                const depositTreeRootStr = this.depositTreeRootInBlock.toString();
                logger.info(`update depositTreeRootInBlock after fetch the latest depositTreeRoot: ${depositTreeRootStr}`);
                const dataTreeRootStr = this.currentDataRoot.toString();
                depositTxList.forEach(tx => {
                    tx.depositRoot = depositTreeRootStr;
                    tx.dataRoot = dataTreeRootStr;
                });

                blockCachedWitnessDc = new BlockCache();
                blockCachedWitnessDc.blockId = currentBlockId;
                blockCachedWitnessDc.cache = JSON.stringify(dcWitnessWrapper.witnesses);
                blockCachedWitnessDc.type = BlockCacheType.DEPOSIT_COMMITMENTS_WITNESS;
                await queryRunner.manager.save(blockCachedWitnessDc);
                logger.info(`save BlockCache of DEPOSIT_COMMITMENTS_WITNESS`);
            }

            const rollupSize = mpTxList.length;
            const nonDummyTxList = [...mpTxList];

            const mod = mpTxList.length % innerRollupTxNum;
            if (mod > 0) {//ie. == 1
                // calc dummy tx
                let pendingTxSize = innerRollupTxNum - mod;
                logger.info(`append ${pendingTxSize} dummyTx...`)
                // fill dummy tx
                for (let index = 0; index < pendingTxSize; index++) {
                    const dummyTx = config.joinsplitProofDummyTx;
                    mpTxList.push({
                        actionType: dummyTx.publicOutput.actionType.toString(),
                        outputNoteCommitment1: dummyTx.publicOutput.outputNoteCommitment1.toString(),
                        outputNoteCommitment2: dummyTx.publicOutput.outputNoteCommitment2.toString(),

                        nullifier1: dummyTx.publicOutput.nullifier1.toString(),
                        nullifier2: dummyTx.publicOutput.nullifier2.toString(),

                        dataRoot: this.currentDataRoot.toString(),

                        depositRoot: dummyTx.publicOutput.depositRoot.toString(),
                        depositIndex: dummyTx.publicOutput.depositIndex.toString(),

                        publicAssetId: dummyTx.publicOutput.publicAssetId.toString(),
                        publicOwner: dummyTx.publicOutput.publicOwner.toBase58(),
                        publicValue: dummyTx.publicOutput.publicValue.toString(),
                        txFeeAssetId: dummyTx.publicOutput.txFeeAssetId.toString(),
                        txFee: dummyTx.publicOutput.txFee.toString(),

                        proof: JSON.stringify(dummyTx.toJSON())
                    } as MemPlL2Tx);
                }
            }

            const totalTxFee = mpTxList.reduce((p, c) => {
                return p + Number(c.txFee)
            }, 0);


            // pre insert into tree cache
            let innerRollup_proveTxBatchParamList = await this.preInsertIntoTreeCache(mpTxList);

            // prepare txFee valueNote
            const feeValueNote = new ValueNote({
                secret: Poseidon.hash([Field.random()]),
                ownerPk: PrivateKey.fromBase58(config.operatorPrivateKey).toPublicKey(),
                accountRequired: Field(1),
                creatorPk: PublicKey.empty(),
                value: UInt64.from(nonDummyTxList.reduce((p, c, i) => {
                    return Number(c.txFee) + p;
                }, 0)),
                assetId: AssetId.MINA,
                inputNullifier: Poseidon.hash([Field.random()]),
                noteType: NoteType.WITHDRAWAL
            });
            const txFeeCommitment = feeValueNote.commitment();
            const txFeeCommitmentIdx = this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, true).toString();
            const txFeeSiblingPath = (await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, BigInt(txFeeCommitmentIdx), true))!.path;
            const txFeeCtEmptyLeafWitness = {
                leafIndex: Number(txFeeCommitmentIdx),
                commitment: DUMMY_FIELD.toString(),
                paths: txFeeSiblingPath.map(p => p.toString())
            } as MerkleProofDto;
            await this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, txFeeCommitment);
            logger.info(`appendLeaf: txFeeCommitment: ${txFeeCommitment.toString()}`);

            this.targetDataRoot = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, true);
            this.targetNullifierRoot = this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true);
            // insert new data_root
            const dataRootLeafIndex = this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);
            const dataRootSiblingPath = (await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, BigInt(dataRootLeafIndex), false))!.path;
            const dataRootEmptyLeafWitness = {
                leafIndex: Number(dataRootLeafIndex),
                commitment: DUMMY_FIELD.toString(),
                paths: dataRootSiblingPath.map(p => p.toString())
            } as MerkleProofDto;
            await this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE_ROOTS_TREE, this.targetDataRoot);
            this.targetRootTreeRoot = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, true);

            // create a new block
            let block = new Block();
            block.id = currentBlockId;
            block.status = BlockStatus.PENDING;
            block.rollupSize = rollupSize;// TODO non-dummy?
            block.rootTreeRoot0 = this.currentRootTreeRoot.toString();
            block.dataTreeRoot0 = this.currentDataRoot.toString();
            block.nullifierTreeRoot0 = this.currentNullifierRoot.toString();
            block.depositRoot = this.depositTreeRootInBlock.toString();
            block.depositStartIndex0 = this.depositStartIndexInBlock.toString();
            block.rootTreeRoot1 = this.targetRootTreeRoot.toString();
            block.dataTreeRoot1 = this.targetDataRoot.toString();
            block.dataTreeRoot1Indx = dataRootLeafIndex.toString();
            block.nullifierTreeRoot1 = this.targetNullifierRoot.toString();
            block.depositStartIndex1 = this.depositEndIndexInBlock.toString();
            block.depositCount = depositCount;
            block.totalTxFees = totalTxFee.toString();
            block.txFeeCommitment = txFeeCommitment.toString();
            block.txFeeReceiver = feeValueNote.ownerPk.toBase58();
            const sourceRollupState = new RollupState({
                dataRoot: Field(block.dataTreeRoot0),
                nullifierRoot: Field(block.nullifierTreeRoot0),
                dataRootsRoot: Field(block.rootTreeRoot0),
                depositStartIndex: Field(block.depositStartIndex0),
            });
            const targetRollupState = new RollupState({
                dataRoot: Field(block.dataTreeRoot1),
                nullifierRoot: Field(block.nullifierTreeRoot1),
                dataRootsRoot: Field(block.rootTreeRoot1),
                depositStartIndex: Field(block.depositStartIndex1),
            });
            const rollupStateTransition = new RollupStateTransition({
                source: sourceRollupState,
                target: targetRollupState
            });
            block.blockHash = new BlockProveOutput({
                blockHash: Field.random(),
                rollupSize: Field(block.rollupSize),
                stateTransition: rollupStateTransition,
                depositRoot: Field(block.depositRoot),
                depositCount: Field(block.depositCount),
                totalTxFees: [new TxFee({
                    assetId: Field('0'),
                    fee: UInt64.from(block.totalTxFees)
                })],
                txFeeReceiver: PublicKey.fromBase58(block.txFeeReceiver),
            }).generateBlockHash().toString();

            block = await queryRunner.manager.save(block);// save it

            const cachedUpdatesDataTree = this.worldStateDB.exportCacheUpdates(MerkleTreeId.DATA_TREE);
            logger.info(`block.id: ${block.id}, DATA_TREE's cachedUpdates: ${JSON.stringify(cachedUpdatesDataTree)}`);
            const blockCachedUpdatesDataTree = new BlockCache();
            blockCachedUpdatesDataTree.blockId = block.id;
            blockCachedUpdatesDataTree.cache = JSON.stringify(cachedUpdatesDataTree);
            blockCachedUpdatesDataTree.type = BlockCacheType.DATA_TREE_UPDATES;//  0
            blockCachedUpdatesDataTree.status = BlockCacheStatus.PENDING;
            await queryRunner.manager.save(blockCachedUpdatesDataTree);

            const cachedUpdatesNullifierTree = this.worldStateDB.exportCacheUpdates(MerkleTreeId.NULLIFIER_TREE);
            logger.info(`block.id: ${block.id}, NULLIFIER_TREE's cachedUpdates: ${JSON.stringify(cachedUpdatesNullifierTree)}`);
            const blockCachedUpdatesNullifierTree = new BlockCache();
            blockCachedUpdatesNullifierTree.blockId = block.id;
            blockCachedUpdatesNullifierTree.cache = JSON.stringify(cachedUpdatesNullifierTree);
            blockCachedUpdatesNullifierTree.type = BlockCacheType.NULLIFIER_TREE_UPDATES;//  4
            blockCachedUpdatesNullifierTree.status = BlockCacheStatus.PENDING;
            await queryRunner.manager.save(blockCachedUpdatesNullifierTree);

            const cachedUpdatesRootTree = this.worldStateDB.exportCacheUpdates(MerkleTreeId.DATA_TREE_ROOTS_TREE);
            logger.info(`block.id: ${block.id}, DATA_TREE_ROOTS_TREE's cachedUpdates: ${JSON.stringify(cachedUpdatesRootTree)}`);
            const blockCachedUpdatesRootTree = new BlockCache();
            blockCachedUpdatesRootTree.blockId = block.id;
            blockCachedUpdatesRootTree.cache = JSON.stringify(cachedUpdatesRootTree);
            blockCachedUpdatesRootTree.type = BlockCacheType.DATA_TREE_ROOTS_TREE_UPDATES;//  5
            blockCachedUpdatesRootTree.status = BlockCacheStatus.PENDING;
            await queryRunner.manager.save(blockCachedUpdatesRootTree);

            // cache txFee's empty leaf witness
            const blockCachedWitnessTxFee = new BlockCache();
            blockCachedWitnessTxFee.blockId = block.id;
            blockCachedWitnessTxFee.cache = JSON.stringify(txFeeCtEmptyLeafWitness);
            blockCachedWitnessTxFee.type = BlockCacheType.TX_FEE_EMPTY_LEAF_WITNESS;// 1
            await queryRunner.manager.save(blockCachedWitnessTxFee);

            // cache dataTreeRoot's empty leaf witness
            const blockCachedWitnessDataRoot = new BlockCache();
            blockCachedWitnessDataRoot.blockId = block.id;
            blockCachedWitnessDataRoot.cache = JSON.stringify(dataRootEmptyLeafWitness);
            blockCachedWitnessDataRoot.type = BlockCacheType.DATA_TREE_ROOT_EMPTY_LEAF_WITNESS;// 2
            await queryRunner.manager.save(blockCachedWitnessDataRoot);

            const txFeeWithdrawInfo = new WithdrawInfo();
            txFeeWithdrawInfo.secret = feeValueNote.secret.toString();
            txFeeWithdrawInfo.ownerPk = feeValueNote.ownerPk.toBase58();
            txFeeWithdrawInfo.accountRequired = feeValueNote.accountRequired.toString();
            txFeeWithdrawInfo.creatorPk = feeValueNote.creatorPk.toBase58();
            txFeeWithdrawInfo.value = feeValueNote.value.toString();
            txFeeWithdrawInfo.assetId = feeValueNote.assetId.toString();
            txFeeWithdrawInfo.inputNullifier = feeValueNote.inputNullifier.toString();
            txFeeWithdrawInfo.noteType = feeValueNote.noteType.toString();
            txFeeWithdrawInfo.outputNoteCommitment = txFeeCommitment.toString();
            txFeeWithdrawInfo.outputNoteCommitmentIdx = txFeeCommitmentIdx;
            txFeeWithdrawInfo.status = WithdrawNoteStatus.PENDING;
            await queryRunner.manager.save(txFeeWithdrawInfo);

            // del mpL2Tx from memory pool
            const mpL2TxHashes = nonDummyTxList.map(tx => {
                return tx.txHash;
            })
            await queryRunner.manager.delete(MemPlL2Tx, mpL2TxHashes);

            // update L2Tx and move to L2Tx table
            const l2TxList = nonDummyTxList.map((mpL2Tx, i) => {
                // transfer value from mpL2Tx to L2Tx
                mpL2Tx.status = L2TxStatus.CONFIRMED;
                mpL2Tx.blockId = block.id;
                mpL2Tx.blockHash = block.blockHash;
                mpL2Tx.indexInBlock = i;

                const l2tx = new L2Tx();
                Object.assign(l2tx, mpL2Tx);

                return l2tx;
            })
            await queryRunner.manager.save(l2TxList);// insert all!

            // save innerRollupBatch
            const innerRollupBatch = new InnerRollupBatch();
            innerRollupBatch.inputParam = JSON.stringify(innerRollup_proveTxBatchParamList);
            innerRollupBatch.blockId = block.id;
            await queryRunner.manager.save(innerRollupBatch);

            // update DepositStatus.CONFIRMED
            const dcCommitments = nonDummyTxList.filter(tx => {
                return tx.actionType == ActionType.DEPOSIT.toString();
            }).map(tx => {
                return tx.outputNoteCommitment1
            })
            await queryRunner.manager.update(DepositCommitment, { depositNoteCommitment: In(dcCommitments) }, { status: DepositStatus.CONFIRMED });// TODO imporve here?

            // cache in indexDB
            let batchOps: { key: any, value: any }[] = [];
            batchOps.push({
                key: `LATESTBLOCK`,
                value: block.id
            });
            nonDummyTxList.forEach((tx, i) => {
                /**
                 * cache KV for acceleration:
                 * * L2TX:{noteHash} -> l2tx
                 * * DataTree:{comitment} -> leafIndex
                 * * NullifierTree:{nullifier} -> leafIndex
                 */

                if (tx.outputNoteCommitment1 != '0') {
                    batchOps.push({
                        key: `L2TX:${tx.outputNoteCommitment1}`,// no 0
                        value: tx.txHash
                    });
                    batchOps.push({
                        key: `${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${tx.outputNoteCommitment1}`,// no 0
                        value: tx.outputNoteCommitmentIdx1
                    });
                }
                if (tx.outputNoteCommitment2 != '0') {
                    batchOps.push({
                        key: `L2TX:${tx.outputNoteCommitment2}`,// no 0
                        value: tx.txHash
                    });
                    batchOps.push({
                        key: `${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${tx.outputNoteCommitment2}`,// no 0
                        value: tx.outputNoteCommitmentIdx2
                    })
                }

                if (tx.nullifier1 != '0') {
                    batchOps.push({
                        key: `L2TX:${tx.nullifier1}`,// no 0
                        value: tx.txHash
                    });
                    batchOps.push({
                        key: `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${tx.nullifier1}`,// no 0
                        value: tx.nullifierIdx1
                    })
                }
                if (tx.nullifier2 != '0') {
                    batchOps.push({
                        key: `L2TX:${tx.nullifier2}`,// no 0
                        value: tx.txHash
                    });
                    batchOps.push({
                        key: `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${tx.nullifier2}`,// no 0
                        value: tx.nullifierIdx2
                    })
                }
            });

            batchOps.push({
                key: `${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${txFeeCommitment.toString()}`,
                value: txFeeCommitmentIdx
            });
            batchOps.push({
                key: `${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${this.targetDataRoot.toString()}`,
                value: dataRootLeafIndex.toString()
            });

            const batchOpStr = JSON.stringify(batchOps);
            logger.info(`block.id: ${block.id}, indexDB's cachedUpdates: ${batchOpStr}`);
            const blockCachedUpdatesIndexDB = new BlockCache();
            blockCachedUpdatesIndexDB.blockId = block.id;
            blockCachedUpdatesIndexDB.cache = batchOpStr;
            blockCachedUpdatesIndexDB.type = BlockCacheType.INDEXDB_UPDATES;//  6
            await queryRunner.manager.save(blockCachedUpdatesIndexDB);

            // commit
            await queryRunner.commitTransaction();
            logger.info(`mysqldb.commit.`);

            // if these leveldb ops fail (in the case the process exit after db.commit but before merkletrees commit), it will be checked and fixed during network reboot.
            await this.worldStateDB.commit();
            logger.info(`worldStateDB.commit.`);

            await this.indexDB.batchInsert(batchOps);
            logger.info(`indexDB.batchInsert.`);


            logger.info(`succeed generating block: ${currentBlockId} .`);
        } catch (error) {
            logger.error(error);
            console.log(error);

            try {
                await queryRunner.rollbackTransaction();
                logger.info('mysqldb.rollbackTransaction.');
            } catch (error) {
                logger.info('mysqldb.rollbackTransaction failed!');
            }

            await this.worldStateDB.rollback();
            logger.info('worldStateDB.rollback.');

        } finally {
            // end the flow
            await this.worldState.reset();
            logger.info('reset worldState.');
            logger.info('end.');
            await queryRunner.release();
        }
    }

    private async preInsertIntoTreeCache(txList: MemPlL2Tx[]) {
        logger.info(`start insert into trees...`);
        const innerRollup_proveTxBatchParamList: { txId1: string, txId2: string, innerRollupInput: string, joinSplitProof1: string, joinSplitProof2: string }[] = []

        let depositOldStartIndexTmp = this.depositStartIndexInBlock;
        let depositNewStartIndexTmp = this.depositStartIndexInBlock;
        for (let i = 0; i < txList.length; i += 2) {
            const tx1 = txList[i];// if txList's length is uneven, tx1 would be the last one, ie. this.leftNonDepositTx .
            const tx2 = txList[i + 1];

            logger.info(`processing tx[${i}]:${tx1.txHash}...`);
            logger.info(`processing tx[${i + 1}]:${tx2.txHash}...`);
            logger.info(`depositOldStartIndexTmp: ${depositOldStartIndexTmp}`);
            logger.info(`depositNewStartIndexTmp: ${depositNewStartIndexTmp}`);

            const dataStartIndex: Field = Field(this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, true));
            const oldDataRoot: Field = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, true);
            const nullStartIndex: Field = Field(this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true));
            const oldNullRoot: Field = this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true);
            const dataRootsRoot: Field = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);
            logger.info(`dataStartIndex: ${dataStartIndex}`);
            logger.info(`oldDataRoot: ${oldDataRoot}`);
            logger.info(`nullStartIndex: ${nullStartIndex}`);
            logger.info(`oldNullRoot: ${oldNullRoot}`);
            logger.info(`dataRootsRoot: ${dataRootsRoot}`);

            // ================ tx1 commitment parts ============
            let dataTreeCursor = this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, true);
            logger.info(`currently dataTreeCursor: ${dataTreeCursor}`);

            logger.info(`starts process tx1.outputNoteCommitment1: ${tx1.outputNoteCommitment1}`);
            const tx1OldDataWitness1: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            if (Field(tx1.outputNoteCommitment1).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                tx1.outputNoteCommitmentIdx1 = dataTreeCursor.toString();
                await this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx1.outputNoteCommitment1));
                logger.info(`after appendLeaf, DATA_TREE root: ${this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, true)}`);
                dataTreeCursor += 1n;
                logger.info(`after appendLeaf, dataTreeCursor: ${dataTreeCursor}`);
                logger.info('append tx1.outputNoteCommitment1, done.');
            }

            logger.info(`starts process tx1.outputNoteCommitment2: ${tx1.outputNoteCommitment2}`);
            const tx1OldDataWitness2: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            if (Field(tx1.outputNoteCommitment2).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                tx1.outputNoteCommitmentIdx2 = dataTreeCursor.toString();
                await this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx1.outputNoteCommitment2));
                logger.info(`after appendLeaf, DATA_TREE root: ${this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, true)}`);
                dataTreeCursor += 1n;
                logger.info(`after appendLeaf, dataTreeCursor: ${dataTreeCursor}`);
                logger.info('append tx1.outputNoteCommitment2, done.');
            }

            // ================ tx2 commitment parts ============
            logger.info(`starts process tx2.outputNoteCommitment1: ${tx2.outputNoteCommitment1}`);
            const tx2OldDataWitness1: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            if (Field(tx2.outputNoteCommitment1).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                tx2.outputNoteCommitmentIdx1 = dataTreeCursor.toString();
                await this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx2.outputNoteCommitment1));
                logger.info(`after appendLeaf, DATA_TREE root: ${this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, true)}`);
                dataTreeCursor += 1n;
                logger.info(`after appendLeaf, dataTreeCursor: ${dataTreeCursor}`);
                logger.info('append tx2.outputNoteCommitment1, done.');
            }

            logger.info(`starts process tx2.outputNoteCommitment2: ${tx2.outputNoteCommitment2}`);
            const tx2OldDataWitness2: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            if (Field(tx2.outputNoteCommitment2).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                tx2.outputNoteCommitmentIdx2 = dataTreeCursor.toString();
                await this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx2.outputNoteCommitment2));
                logger.info(`after appendLeaf, DATA_TREE root: ${this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, true)}`);
                dataTreeCursor += 1n;
                logger.info(`after appendLeaf, dataTreeCursor: ${dataTreeCursor}`);
                logger.info('append tx2.outputNoteCommitment2, done.');
            }

            // ================ tx1 nullifier parts ============
            let nullifierTreeCursor = this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true);
            logger.info(`currently nullifierTreeCursor: ${nullifierTreeCursor}`);

            logger.info(`starts process tx1.nullifier1: ${tx1.nullifier1}...`);
            let tx1LowLeafWitness1: LowLeafWitnessData = undefined as any;
            let tx1OldNullWitness1: NullifierMerkleWitness = undefined as any;
            if (Field(tx1.nullifier1).equals(DUMMY_FIELD).not().toBoolean()) {// if non-DEPOSIT
                tx1LowLeafWitness1 = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier1), true);
                logger.info(`tx1LowLeafWitness1: ${JSON.stringify(tx1LowLeafWitness1)}`);

                const predecessorLeafData = tx1LowLeafWitness1.leafData;
                const predecessorIdx = tx1LowLeafWitness1.index.toBigInt();

                if (predecessorLeafData.nextValue.toBigInt() != 0n && predecessorLeafData.nextValue.toBigInt() <= BigInt(tx1.nullifier1)) {
                    logger.error("predecessorLeafData.nextValue.toBigInt()<= BigInt(tx1.nullifier1)");
                    throw new Error("predecessorLeafData.nextValue.toBigInt()<= BigInt(tx1.nullifier1)");
                }

                // modify predecessor                
                logger.info(`before modify predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`before modify predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);
                const modifiedPredecessorLeafDataTmp: LeafData = {
                    value: predecessorLeafData.value.toBigInt(),
                    nextValue: Field(tx1.nullifier1).toBigInt(),
                    nextIndex: nullifierTreeCursor
                };
                await this.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, modifiedPredecessorLeafDataTmp, predecessorIdx);
                logger.info(`after modify predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`after modify predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

                // obtain tx1OldNullWitness1
                tx1OldNullWitness1 = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
                logger.info(`tx1OldNullWitness1: ${JSON.stringify(tx1OldNullWitness1)}`);
                logger.info('obtain tx1OldNullWitness1 done.');

                // revert predecessor
                const revertedPredecessorLeafDataTmp: LeafData = {
                    value: predecessorLeafData.value.toBigInt(),
                    nextValue: predecessorLeafData.nextValue.toBigInt(),
                    nextIndex: predecessorLeafData.nextIndex.toBigInt()
                };
                await this.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, revertedPredecessorLeafDataTmp, predecessorIdx);
                logger.info(`after revert predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`after revert predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

                // insert nullifier1
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier1));
                logger.info(`after insert tx1.nullifier1, NULLIFIER_TREE root: ${this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);

                tx1.nullifierIdx1 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
                logger.info(`after appendLeaf, nullifierTreeCursor: ${nullifierTreeCursor}`);

                logger.info('insert tx1.nullifier1, done.');
            } else {
                tx1OldNullWitness1 = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
                tx1LowLeafWitness1 = LowLeafWitnessData.zero(await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, 0n, true));
                logger.info(`tx1LowLeafWitness1: ${JSON.stringify(tx1LowLeafWitness1)}`);
                logger.info(`tx1OldNullWitness1: ${JSON.stringify(tx1OldNullWitness1)}`);
            }

            logger.info(`starts process tx1.nullifier2: ${tx1.nullifier2}...`);
            let tx1LowLeafWitness2: LowLeafWitnessData = undefined as any;
            let tx1OldNullWitness2: NullifierMerkleWitness = undefined as any;
            if (Field(tx1.nullifier2).equals(DUMMY_FIELD).not().toBoolean()) {// if non-DEPOSIT
                tx1LowLeafWitness2 = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier2), true);
                logger.info(`tx1LowLeafWitness2: ${JSON.stringify(tx1LowLeafWitness2)}`);

                const predecessorLeafData = tx1LowLeafWitness2.leafData;
                const predecessorIdx = tx1LowLeafWitness2.index.toBigInt();

                if (predecessorLeafData.nextValue.toBigInt() != 0n && predecessorLeafData.nextValue.toBigInt() <= BigInt(tx1.nullifier2)) {
                    logger.error("predecessorLeafData.nextValue.toBigInt()<= BigInt(tx1.nullifier2)");
                    throw new Error("predecessorLeafData.nextValue.toBigInt()<= BigInt(tx1.nullifier2)");
                }

                // modify predecessor                
                logger.info(`before modify predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`before modify predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);
                const modifiedPredecessorLeafDataTmp: LeafData = {
                    value: predecessorLeafData.value.toBigInt(),
                    nextValue: Field(tx1.nullifier2).toBigInt(),
                    nextIndex: nullifierTreeCursor
                };
                await this.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, modifiedPredecessorLeafDataTmp, predecessorIdx);
                logger.info(`after modify predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`after modify predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

                // obtain tx1OldNullWitness2
                tx1OldNullWitness2 = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
                logger.info(`tx1OldNullWitness2: ${JSON.stringify(tx1OldNullWitness2)}`);

                // revert predecessor
                const revertedPredecessorLeafDataTmp: LeafData = {
                    value: predecessorLeafData.value.toBigInt(),
                    nextValue: predecessorLeafData.nextValue.toBigInt(),
                    nextIndex: predecessorLeafData.nextIndex.toBigInt()
                };
                await this.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, revertedPredecessorLeafDataTmp, predecessorIdx);
                logger.info(`after revert predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`after revert predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

                // insert nullifier2
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier2));
                logger.info(`after insert tx1.nullifier2, NULLIFIER_TREE root: ${this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);

                tx1.nullifierIdx2 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
                logger.info(`after appendLeaf, nullifierTreeCursor: ${nullifierTreeCursor}`);

                logger.info('insert tx1.nullifier2, done.');
            } else {
                tx1OldNullWitness2 = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
                tx1LowLeafWitness2 = LowLeafWitnessData.zero(await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, 0n, true));
                logger.info(`tx1LowLeafWitness2: ${JSON.stringify(tx1LowLeafWitness2)}`);
                logger.info(`tx1OldNullWitness2: ${JSON.stringify(tx1OldNullWitness2)}`);
            }

            // ================ tx2 nullifier parts ============
            logger.info(`starts process tx2.nullifier1:${tx2.nullifier1}...`);
            let tx2LowLeafWitness1: LowLeafWitnessData = undefined as any;
            let tx2OldNullWitness1: NullifierMerkleWitness = undefined as any;
            if (Field(tx2.nullifier1).equals(DUMMY_FIELD).not().toBoolean()) {// if non-DEPOSIT
                tx2LowLeafWitness1 = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier1), true);
                logger.info(`tx2LowLeafWitness1: ${JSON.stringify(tx2LowLeafWitness1)}`);

                const predecessorLeafData = tx2LowLeafWitness1.leafData;
                const predecessorIdx = tx2LowLeafWitness1.index.toBigInt();

                if (predecessorLeafData.nextValue.toBigInt() != 0n && predecessorLeafData.nextValue.toBigInt() <= BigInt(tx2.nullifier1)) {
                    logger.error("predecessorLeafData.nextValue.toBigInt()<= BigInt(tx2.nullifier1)");
                    throw new Error("predecessorLeafData.nextValue.toBigInt()<= BigInt(tx2.nullifier1)");
                }

                // modify predecessor 
                logger.info(`before modify predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`before modify predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);
                const modifiedPredecessorLeafDataTmp: LeafData = {
                    value: predecessorLeafData.value.toBigInt(),
                    nextValue: Field(tx2.nullifier1).toBigInt(),
                    nextIndex: nullifierTreeCursor
                };
                await this.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, modifiedPredecessorLeafDataTmp, predecessorIdx);
                logger.info(`after modify predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`after modify predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

                // obtain tx2OldNullWitness1
                tx2OldNullWitness1 = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
                logger.info(`tx2OldNullWitness1: ${JSON.stringify(tx2OldNullWitness1)}`);

                // revert predecessor
                const revertedPredecessorLeafDataTmp: LeafData = {
                    value: predecessorLeafData.value.toBigInt(),
                    nextValue: predecessorLeafData.nextValue.toBigInt(),
                    nextIndex: predecessorLeafData.nextIndex.toBigInt()
                };
                await this.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, revertedPredecessorLeafDataTmp, predecessorIdx);
                logger.info(`after revert predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`after revert predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

                // insert nullifier1
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier1));
                logger.info(`after insert tx2.nullifier1, NULLIFIER_TREE root: ${this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);

                tx2.nullifierIdx1 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
                logger.info(`after appendLeaf, nullifierTreeCursor: ${nullifierTreeCursor}`);

                logger.info('insert tx2.nullifier1, done.');
            } else {
                tx2OldNullWitness1 = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
                tx2LowLeafWitness1 = LowLeafWitnessData.zero(await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, 0n, true));
                logger.info(`tx2LowLeafWitness1: ${JSON.stringify(tx2LowLeafWitness1)}`);
                logger.info(`tx2OldNullWitness1: ${JSON.stringify(tx2OldNullWitness1)}`);
            }

            logger.info(`starts process tx2.nullifier2:${tx2.nullifier2}...`);
            let tx2LowLeafWitness2: LowLeafWitnessData = undefined as any;
            let tx2OldNullWitness2: NullifierMerkleWitness = undefined as any;
            if (Field(tx2.nullifier2).equals(DUMMY_FIELD).not().toBoolean()) {// if non-DEPOSIT
                tx2LowLeafWitness2 = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier2), true);
                logger.info(`tx2LowLeafWitness2: ${JSON.stringify(tx2LowLeafWitness2)}`);

                const predecessorLeafData = tx2LowLeafWitness2.leafData;
                const predecessorIdx = tx2LowLeafWitness2.index.toBigInt();

                if (predecessorLeafData.nextValue.toBigInt() != 0n && predecessorLeafData.nextValue.toBigInt() <= BigInt(tx2.nullifier2)) {
                    logger.error("predecessorLeafData.nextValue.toBigInt()<= BigInt(tx2.nullifier2)");
                    throw new Error("predecessorLeafData.nextValue.toBigInt()<= BigInt(tx2.nullifier2)");
                }

                // modify predecessor                
                logger.info(`before modify predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`before modify predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);
                const modifiedPredecessorLeafDataTmp: LeafData = {
                    value: predecessorLeafData.value.toBigInt(),
                    nextValue: Field(tx2.nullifier2).toBigInt(),
                    nextIndex: nullifierTreeCursor
                };
                await this.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, modifiedPredecessorLeafDataTmp, predecessorIdx);
                logger.info(`after modify predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`after modify predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

                // obtain tx2OldNullWitness2
                tx2OldNullWitness2 = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
                logger.info(`tx2OldNullWitness2: ${JSON.stringify(tx2OldNullWitness2)}`);

                // revert predecessor
                const revertedPredecessorLeafDataTmp: LeafData = {
                    value: predecessorLeafData.value.toBigInt(),
                    nextValue: predecessorLeafData.nextValue.toBigInt(),
                    nextIndex: predecessorLeafData.nextIndex.toBigInt()
                };
                await this.worldStateDB.updateLeaf(MerkleTreeId.NULLIFIER_TREE, revertedPredecessorLeafDataTmp, predecessorIdx);
                logger.info(`after revert predecessor, nullifierTree Root: ${await this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);
                logger.info(`after revert predecessor, nullifierTree Num: ${await this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true)}`);

                // insert nullifier2
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier2));
                logger.info(`after insert tx2.nullifier2, NULLIFIER_TREE root: ${this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true)}`);

                tx2.nullifierIdx2 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
                logger.info(`after appendLeaf, nullifierTreeCursor: ${nullifierTreeCursor}`);

                logger.info('insert tx2.nullifier2, done.');
            } else {
                tx2OldNullWitness2 = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
                tx2LowLeafWitness2 = LowLeafWitnessData.zero(await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, 0n, true));
                logger.info(`tx2LowLeafWitness2: ${JSON.stringify(tx2LowLeafWitness2)}`);
                logger.info(`tx2OldNullWitness2: ${JSON.stringify(tx2OldNullWitness2)}`);
            }


            // ================ root tree parts ============
            const tx1DataTreeRootIndex = String((await this.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${tx1.dataRoot}`)));
            logger.info(`tx1DataTreeRootIndex: ${tx1DataTreeRootIndex}`);
            const tx1RootWitnessData: DataRootWitnessData = {
                dataRootIndex: Field(tx1DataTreeRootIndex),
                witness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, BigInt(tx1DataTreeRootIndex), false)
            };
            const tx2DataTreeRootIndex = String(await this.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${tx2.dataRoot}`));
            logger.info(`tx2DataTreeRootIndex: ${tx2DataTreeRootIndex}`);
            const tx2RootWitnessData: DataRootWitnessData = {
                dataRootIndex: Field(tx2DataTreeRootIndex),
                witness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, BigInt(tx2DataTreeRootIndex), false)
            };

            // ===================== calc oldDepositStartIndex =====================
            // * depositNewStartIndexTmp of current merged pair= depositOldStartIndexTmp + DepositTx count of current merged pair,
            // * And depositOldStartIndexTmp = the first DepositTx's 'depositIndex' in current merged pair = depositNewStartIndexTmp of last pair containing depositTx.
            // * But if neither tx are DepositTx, then depositOldStartIndexTmp = depositNewStartIndexTmp = depositNewStartIndexTmp of last pair containing depositTx
            if (Field(tx1.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                logger.info(`tx1.actionType: DEPOSIT`);
                depositOldStartIndexTmp = Field(tx1.depositIndex);
            } else if (Field(tx2.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                logger.info(`tx2.actionType: DEPOSIT`);
                depositOldStartIndexTmp = Field(tx2.depositIndex);
            }
            if (Field(tx1.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                logger.info(`tx1.actionType: DEPOSIT`);
                depositNewStartIndexTmp = depositNewStartIndexTmp.add(1);
            }
            if (Field(tx2.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                logger.info(`tx2.actionType: DEPOSIT`);
                depositNewStartIndexTmp = depositNewStartIndexTmp.add(1);
            }
            logger.info(`update depositOldStartIndexTmp: ${depositOldStartIndexTmp}`);
            logger.info(`update depositNewStartIndexTmp: ${depositNewStartIndexTmp}`);

            // TODO no need stringfy it!
            const innerRollupInputStr = JSON.stringify({
                dataStartIndex,
                oldDataRoot,
                tx1OldDataWitness1,
                tx1OldDataWitness2,
                tx2OldDataWitness1,
                tx2OldDataWitness2,

                nullStartIndex,
                oldNullRoot,
                tx1LowLeafWitness1,
                tx1LowLeafWitness2,
                tx2LowLeafWitness1,
                tx2LowLeafWitness2,

                tx1OldNullWitness1,
                tx1OldNullWitness2,
                tx2OldNullWitness1,
                tx2OldNullWitness2,

                dataRootsRoot,
                tx1RootWitnessData,
                tx2RootWitnessData,

                depositRoot: this.depositTreeRootInBlock,
                oldDepositStartIndex: depositOldStartIndexTmp
            })

            innerRollup_proveTxBatchParamList.push(
                {
                    txId1: tx1.txHash,
                    txId2: tx2.txHash,
                    joinSplitProof1: tx1.proof,// if tx1 is depositL2Tx, then tx1.proof is undefined currently!
                    joinSplitProof2: tx2.proof,// if tx2 is depositL2Tx, then tx1.proof is undefined currently!
                    innerRollupInput: innerRollupInputStr
                }
            );

            // as talked above, depositOldStartIndexTmp = the first DepositTx's 'depositIndex' in each merged pair = depositNewStartIndexTmp of last pair containing depositTx,
            depositOldStartIndexTmp = depositNewStartIndexTmp;
        }
        return innerRollup_proveTxBatchParamList;
    }

    /**
     * check if there are some other txs containing the same nullifier1/2, then select the ones with highest txFee.and make the others fail into DB_MemPlL2Tx!!
     * NOTE: this checks must be placed here and cannot be placed at '/receive/tx'.
     */
    private async ridLessFeeOnesIfDoubleSpend(mpTxList: MemPlL2Tx[]) {
        const validMpL2TxSet = new Set<MemPlL2Tx>();

        const map = new Map<string, MemPlL2Tx>();
        mpTxList.forEach(tx => {
            if (tx.actionType == ActionType.DEPOSIT.toString()) {// CAN NOT exclude Account, because there might be at least two users registerring the same alias.
                validMpL2TxSet.add(tx);
                return;
            }
            const tx1 = map.get(tx.nullifier1);
            const tx1Fee = Number((tx1?.txFee) ?? '-1');
            if (tx1Fee < Number(tx.txFee)) {
                map.set(tx.nullifier1, tx);
            }
            const tx2 = map.get(tx.nullifier2);
            const tx2Fee = Number((tx2?.txFee) ?? '-1');
            if (tx2Fee < Number(tx.txFee)) {
                map.set(tx.nullifier2, tx);
            }
        });

        let i = 0;
        let values = map.values();
        while (i < map.size) {
            validMpL2TxSet.add(values.next().value);
            i++;
        }

        // start a Mysql.transaction
        const queryRunner = getConnection().createQueryRunner();
        await queryRunner.startTransaction();
        try {
            // rm duplicate
            const ridTxList: MemPlL2Tx[] = [];
            mpTxList.forEach(tx => {
                if (!validMpL2TxSet.has(tx)) {
                    tx.status = L2TxStatus.FAILED;
                    ridTxList.push(tx);
                }
            });
            logger.info(`ridLessFeeOnesIfDoubleSpend: ${ridTxList.map(r => r.txHash)}`);
            await queryRunner.manager.save(ridTxList);

            await queryRunner.commitTransaction();

            return [...validMpL2TxSet];
        } catch (error) {
            logger.error(error);
            await queryRunner.rollbackTransaction();

            throw new Error(`ridTxList failed... `);

        } finally {
            await queryRunner.release();
        }
    }
}
