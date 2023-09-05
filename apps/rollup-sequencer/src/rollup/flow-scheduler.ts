
import config from "@/lib/config";
import { DepositStatus, MerkleTreeId, L2TxStatus, PoseidonHasher, MerkleProofDto, BlockCacheType, BaseResponse, BlockStatus } from "@anomix/types";
import {
    DataMerkleWitness, DataRootWitnessData, LowLeafWitnessData, NullifierMerkleWitness,
    DUMMY_FIELD, AnomixEntryContract, AnomixRollupContract, ActionType, NoteType, ValueNote, Commitment
} from "@anomix/circuits";
import { WorldStateDB, WorldState, IndexDB, RollupDB } from "@/worldstate";
import { Block, BlockCache, DepositCommitment, InnerRollupBatch, L2Tx, MemPlL2Tx, WithdrawInfo } from "@anomix/dao";
import { Field, PublicKey, PrivateKey, Poseidon, UInt64 } from 'snarkyjs';
import { syncAcctInfo, uint8ArrayToBase64String } from "@anomix/utils";
import { getConnection, In } from "typeorm";
import { assert } from "console";
import { getLogger } from "@/lib/logUtils";
import { randomBytes, randomInt, randomUUID } from "crypto";
import { $axiosDepositProcessor } from "@/lib";
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
        const rollupContractAddr = PublicKey.fromBase58(config.rollupContractAddress);
        await syncAcctInfo(entryContractAddr);
        await syncAcctInfo(rollupContractAddr);

        const rollupContract = new AnomixRollupContract(rollupContractAddr);
        this.currentDataRoot = rollupContract.state.get().dataRoot;
        this.currentRootTreeRoot = rollupContract.state.get().dataRootsRoot;
        this.currentNullifierRoot = rollupContract.state.get().nullifierRoot;

        const entryContract = new AnomixEntryContract(entryContractAddr);
        this.depositStartIndexInBlock = rollupContract.state.get().depositStartIndex;
        this.depositTreeRootInBlock = entryContract.depositState.get().depositRoot;

        assert(this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false).equals(this.currentDataRoot).toBoolean());
        assert(this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false).equals(this.currentRootTreeRoot).toBoolean());
    }

    async start() {
        // clear dirty data on both rollupDB & worldStateDB at the beginning
        await this.init();

        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();
        try {
            const innerRollupTxNum = config.innerRollup.txCount;

            // query unhandled NON-Deposit Tx list from RollupDB
            let mpTxList = await this.rollupDB.queryPendingTxList();
            if (mpTxList.length == 0) {
                await this.worldState.reset();//  end this flow!
                return;
            }

            // ================== below: mpTxList.length > 0 ==================
            // !!need double check if nullifier1/2 has already been spent!!
            const promises: Promise<any>[] = [];
            mpTxList.forEach(x => {
                promises.push((async () => {
                    if (x.actionType == ActionType.DEPOSIT.toString()) {// exclude Account?
                        return;
                    }
                    const index1 = await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${x.nullifier1}`);
                    if (index1 != -1) {
                        throw new Error(".");
                    }
                    const index2 = await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${x.nullifier2}`);
                    if (index2 != -1) {
                        throw new Error(".");
                    }
                })());
            });
            await Promise.all(promises);

            // !!need double check if nullifier1/2 has already been spent!!
            mpTxList = await this.ridLessFeeOnesIfDoubleSpend(mpTxList);
            if (mpTxList.length == 0) {
                await this.worldState.reset();//  end this flow!
                return;
            }

            // to avoid expected random seq of depositTxList, suggest to sort depositTx within mpTxList
            const nonDepositTxList = mpTxList.filter(tx => {
                return tx.actionType != ActionType.DEPOSIT.toString();
            })
            const depositTxList = mpTxList.filter(tx => {
                return tx.actionType == ActionType.DEPOSIT.toString();
            }).sort((a, b) => {
                return Number(a.depositIndex) - Number(b.depositIndex);
            });
            mpTxList = [...nonDepositTxList, ...depositTxList];

            const depositCount = depositTxList.length;
            this.depositEndIndexInBlock = this.depositStartIndexInBlock.add(depositCount);

            if (depositCount > 0) {
                //  coordinator has already stopped Broadcasting DepositRollupProof as L1Tx.
                await $axiosDepositProcessor.get<BaseResponse<string>>('/rollup/deposit-tree-root').then(r => {
                    if (r.data.code == 1) {
                        throw new Error(`could not obtain latest DEPOSIT_TREE root: ${r.data.msg}`);
                    }
                    this.depositTreeRootInBlock = Field(r.data.data!);
                });

                // pre fill with the latest depositTreeRoot
                const depositTreeRootStr = this.depositTreeRootInBlock.toString();
                const dataTreeRootStr = this.currentDataRoot.toString();
                depositTxList.forEach(tx => {
                    tx.depositRoot = depositTreeRootStr;
                    tx.dataRoot = dataTreeRootStr;
                });
            }

            const rollupSize = mpTxList.length;
            const nonDummyTxList = [...mpTxList];

            const mod = mpTxList.length % innerRollupTxNum;
            if (mod > 0) {//ie. == 1
                // calc dummy tx
                let pendingTxSize = innerRollupTxNum - mod;
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
                ownerPk: PrivateKey.fromBase58(config.rollupContractPrivateKey).toPublicKey(),
                accountRequired: Field(1),
                creatorPk: PublicKey.empty(),
                value: UInt64.from(nonDummyTxList.reduce((p, c, i) => {
                    return Number(c.txFee) + p;
                }, 0)),
                assetId: Field(1),// TODO
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


            this.targetDataRoot = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, true);
            this.targetNullifierRoot = this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true);
            // insert new data_root
            const dataRootLeafIndex = this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);
            const dataRootSiblingPath = (await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, BigInt(dataRootLeafIndex), true))!.path;
            const dataRootEmptyLeafWitness = {
                leafIndex: Number(dataRootLeafIndex),
                commitment: DUMMY_FIELD.toString(),
                paths: dataRootSiblingPath.map(p => p.toString())
            } as MerkleProofDto;
            this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE_ROOTS_TREE, this.targetDataRoot);
            this.targetRootTreeRoot = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, true);

            // create a new block
            let block = new Block();
            block.blockHash = '';// TODO
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
            block = await queryRunner.manager.save(block);// save it

            const cachedUpdates = this.worldStateDB.exportCacheUpdates(MerkleTreeId.DATA_TREE);
            const blockCachedUpdates = new BlockCache();
            blockCachedUpdates.blockId = block.id;
            blockCachedUpdates.cache = cachedUpdates;
            blockCachedUpdates.type = BlockCacheType.DATA_TREE_UPDATES;//  0
            await queryRunner.manager.save(blockCachedUpdates);

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
            await queryRunner.manager.save(txFeeWithdrawInfo);

            // del mpL2Tx from memory pool
            const mpL2TxIds = nonDummyTxList.map(tx => {
                return tx.id;
            })
            await queryRunner.manager.delete(MemPlL2Tx, mpL2TxIds);

            // update L2Tx and move to L2Tx table
            nonDummyTxList.forEach((tx, i) => {
                if (tx.actionType == ActionType.DEPOSIT.toString()) {
                    tx.dataRoot = this.currentDataRoot.toString();
                }
                tx.id = undefined as any;// TODO Need check if could insert!
                tx.status = L2TxStatus.CONFIRMED;
                tx.blockId = block.id;
                tx.blockHash = block.blockHash;
                tx.indexInBlock = i;
            })
            await queryRunner.manager.save(nonDummyTxList as L2Tx[]);// insert all!

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

            // commit
            await queryRunner.commitTransaction();

            // TODO =======================need make them into a Distributed Transaction =======================

            // commit leveldb at last
            await this.worldStateDB.commit();

            // cache in indexDB
            let batch: { key: any, value: any }[] = [];
            nonDummyTxList.forEach((tx, i) => {
                /**
                 * cache KV for acceleration:
                 * * L2TX:{noteHash} -> l2tx
                 * * DataTree:{comitment} -> leafIndex
                 * * NullifierTree:{nullifier} -> leafIndex
                 */

                if (tx.outputNoteCommitment1 != '0') {
                    batch.push({
                        key: `L2TX:${tx.outputNoteCommitment1}`,// no 0
                        value: tx.txHash
                    });
                    batch.push({
                        key: `${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${tx.outputNoteCommitment1}`,// no 0
                        value: tx.outputNoteCommitmentIdx1
                    });
                }
                if (tx.outputNoteCommitment2 != '0') {
                    batch.push({
                        key: `L2TX:${tx.outputNoteCommitment2}`,// no 0
                        value: tx.txHash
                    });
                    batch.push({
                        key: `${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${tx.outputNoteCommitment2}`,// no 0
                        value: tx.outputNoteCommitmentIdx2
                    })
                }

                if (tx.nullifier1 != '0') {
                    batch.push({
                        key: `L2TX:${tx.nullifier1}`,// no 0
                        value: tx.txHash
                    });
                    batch.push({
                        key: `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${tx.nullifier1}`,// no 0
                        value: tx.nullifierIdx1
                    })
                }
                if (tx.nullifier2 != '0') {
                    batch.push({
                        key: `L2TX:${tx.nullifier2}`,// no 0
                        value: tx.txHash
                    });
                    batch.push({
                        key: `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${tx.nullifier2}`,// no 0
                        value: tx.nullifierIdx2
                    })
                }
            });

            batch.push({
                key: `${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${txFeeCommitment.toString()}`,
                value: txFeeCommitmentIdx
            });
            batch.push({
                key: `${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${this.targetRootTreeRoot.toString()}`,
                value: dataRootLeafIndex.toString()
            });
            // TODO !!! although it will not break consistency, need consider extreme case where some mechenism if this.indexDB.batchInsert(*) fails.!!!
            await this.indexDB.batchInsert(batch);

        } catch (error) {
            logger.error(error);
            console.log(error);

            await queryRunner.rollbackTransaction();
            await this.worldStateDB.rollback();
        } finally {
            // end the flow
            await this.worldState.reset();
            await queryRunner.release();
        }
    }

    private async preInsertIntoTreeCache(txList: MemPlL2Tx[]) {
        const innerRollup_proveTxBatchParamList: { txId1: number, txId2: number, innerRollupInput: string, joinSplitProof1: string, joinSplitProof2: string }[] = []

        let depositOldStartIndexTmp = this.depositStartIndexInBlock;
        let depositNewStartIndexTmp = this.depositStartIndexInBlock;
        for (let i = 0; i < txList.length; i += 2) {
            const tx1 = txList[i];// if txList's length is uneven, tx1 would be the last one, ie. this.leftNonDepositTx .
            const tx2 = txList[i + 1];
            if (!tx2) {// if txList's length is uneven, tx2 would be 'undefined'.
                break;
            }

            const dataStartIndex: Field = Field(this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, true));
            const oldDataRoot: Field = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, true);
            const nullStartIndex: Field = Field(this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true));
            const oldNullRoot: Field = this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true);
            const dataRootsRoot: Field = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);


            // ================ tx1 commitment parts ============
            let dataTreeCursor = this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE, true);

            const tx1OldDataWitness1: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx1.outputNoteCommitmentIdx1 = dataTreeCursor.toString();
            if (Field(tx1.outputNoteCommitment1).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx1.outputNoteCommitment1));
                dataTreeCursor += 1n;
            }

            const tx1OldDataWitness2: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx1.outputNoteCommitmentIdx2 = dataTreeCursor.toString();
            if (Field(tx1.outputNoteCommitment2).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx1.outputNoteCommitment2));
                dataTreeCursor += 1n;
            }

            // ================ tx2 commitment parts ============
            const tx2OldDataWitness1: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx2.outputNoteCommitmentIdx1 = dataTreeCursor.toString();
            if (Field(tx2.outputNoteCommitment1).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx2.outputNoteCommitment1));
                dataTreeCursor += 1n;
            }

            const tx2OldDataWitness2: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx2.outputNoteCommitmentIdx2 = dataTreeCursor.toString();
            if (Field(tx2.outputNoteCommitment2).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx2.outputNoteCommitment2));
                dataTreeCursor += 1n;
            }

            // ================ tx1 nullifier parts ============
            let nullifierTreeCursor = this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true);

            let tx1LowLeafWitness1: LowLeafWitnessData = undefined as any;
            const tx1OldNullWitness1 = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx1.nullifier1).equals(DUMMY_FIELD).not().toBoolean()) {// if non-DEPOSIT
                tx1LowLeafWitness1 = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier1), true);

                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier1))
                tx1.nullifierIdx1 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            } else {
                tx1LowLeafWitness1 = LowLeafWitnessData.zero(await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, 0n, true));
            }

            let tx1LowLeafWitness2: LowLeafWitnessData = undefined as any;
            const tx1OldNullWitness2: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx1.nullifier2).equals(DUMMY_FIELD).not().toBoolean()) {// if non-DEPOSIT
                tx1LowLeafWitness2 = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier2), true);

                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier2))
                tx1.nullifierIdx2 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            } else {
                tx1LowLeafWitness2 = LowLeafWitnessData.zero(await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, 0n, true));
            }

            // ================ tx2 nullifier parts ============
            let tx2LowLeafWitness1: LowLeafWitnessData = undefined as any;
            const tx2OldNullWitness1: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx2.nullifier1).equals(DUMMY_FIELD).not().toBoolean()) {// if non-DEPOSIT
                tx2LowLeafWitness1 = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier1), true);

                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier1))
                tx2.nullifierIdx1 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            } else {
                tx2LowLeafWitness1 = LowLeafWitnessData.zero(await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, 0n, true));
            }

            let tx2LowLeafWitness2: LowLeafWitnessData = undefined as any;
            const tx2OldNullWitness2: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx2.nullifier2).equals(DUMMY_FIELD).not().toBoolean()) {// if non-DEPOSIT
                tx2LowLeafWitness2 = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier2), true);

                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier2))
                tx2.nullifierIdx2 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            } else {
                tx2LowLeafWitness2 = LowLeafWitnessData.zero(await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, 0n, true));
            }


            // ================ root tree parts ============
            const tx1DataTreeRootIndex: string = await this.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${tx1.dataRoot}`);//TODO
            const tx1RootWitnessData: DataRootWitnessData = {
                dataRootIndex: Field(tx1DataTreeRootIndex),
                witness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, BigInt(tx1DataTreeRootIndex), false)
            };
            const tx2DataTreeRootIndex: string = await this.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${tx2.dataRoot}`);//TODO
            const tx2RootWitnessData: DataRootWitnessData = {
                dataRootIndex: Field(tx2DataTreeRootIndex),
                witness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, BigInt(tx2DataTreeRootIndex), false)
            };

            // ===================== calc oldDepositStartIndex =====================
            // * depositNewStartIndexTmp of current merged pair= depositOldStartIndexTmp + DepositTx count of current merged pair,
            // * And depositOldStartIndexTmp = the first DepositTx's 'depositIndex' in current merged pair = depositNewStartIndexTmp of last pair containing depositTx.
            // * But if neither tx are DepositTx, then depositOldStartIndexTmp = depositNewStartIndexTmp = depositNewStartIndexTmp of last pair containing depositTx
            if (Field(tx1.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                depositOldStartIndexTmp = Field(tx1.depositIndex);
            } else if (Field(tx2.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                depositOldStartIndexTmp = Field(tx2.depositIndex);
            }
            if (Field(tx1.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                depositNewStartIndexTmp = depositNewStartIndexTmp.add(1);
            }
            if (Field(tx2.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                depositNewStartIndexTmp = depositNewStartIndexTmp.add(1);
            }

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
                    txId1: tx1.id,
                    txId2: tx2.id,
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
            if (tx.actionType == ActionType.DEPOSIT.toString()) {// exclude Account???
                validMpL2TxSet.add(tx);
                return;
            }
            const tx1 = map.get(tx.nullifier1);
            if ((Number((tx1?.txFee) ?? '0')) < Number(tx.txFee)) {
                map.set(tx.nullifier1, tx);
            }
            const tx2 = map.get(tx.nullifier2);
            if ((Number((tx2?.txFee) ?? '0')) < Number(tx.txFee)) {
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
