
import config from "@/lib/config";
import { DepositStatus, MerkleTreeId, L2TxStatus } from "@anomix/types";
import {
    DataMerkleWitness, DataRootWitnessData, LowLeafWitnessData, NullifierMerkleWitness,
    DUMMY_FIELD, AnomixEntryContract, AnomixRollupContract, ActionType
} from "@anomix/circuits";
import { WorldStateDB, WorldState, IndexDB, RollupDB } from "@/worldstate";
import { Block, DepositCommitment, InnerRollupBatch, L2Tx, MemPlL2Tx } from "@anomix/dao";
import { Field, PublicKey } from 'snarkyjs';
import { syncAcctInfo } from "@anomix/utils";
import { getConnection, In } from "typeorm";
import { assert } from "console";

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
        this.worldStateDB.rollback();

        // fetch from contract
        const entryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
        const rollupContractAddr = PublicKey.fromBase58(config.rollupContractAddress);
        await syncAcctInfo(entryContractAddr);
        await syncAcctInfo(rollupContractAddr);

        const rollupContract = new AnomixRollupContract(rollupContractAddr);
        this.currentDataRoot = rollupContract.state.get().dataRoot;
        this.currentRootTreeRoot = rollupContract.state.get().dataRootsRoot;

        const entryContract = new AnomixEntryContract(entryContractAddr);
        this.depositStartIndexInBlock = rollupContract.state.get().depositStartIndex;
        this.depositTreeRootInBlock = entryContract.depositState.get().depositRoot;

        assert(this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, false).equals(this.currentDataRoot).toBoolean());
        assert(this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, false).equals(this.currentRootTreeRoot).toBoolean());
    }

    async start() {
        // clear dirty data on both rollupDB & worldStateDB at the beginning
        this.init();

        const innerRollupTxNum = config.innerRollup.txCount;

        // query unhandled NON-Deposit Tx list from RollupDB
        let mpTxList = await this.rollupDB.queryPendingTxList();
        if (mpTxList.length == 0) {
            this.worldState.reset();//  end this flow!
            return;
        }

        // ================== below: mpTxList.length > 0 ==================
        // !!need double check if nullifier1/2 has already been spent!!
        mpTxList.forEach(async x => {
            const index1 = await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${x.nullifier1}`);
            if (index1 != -1) {
                throw new Error(".");
            }
            const index2 = await this.worldState.indexDB.get(`${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${x.nullifier2}`);
            if (index2 != -1) {
                throw new Error(".");
            }
        });
        // !!need double check if nullifier1/2 has already been spent!!
        mpTxList = await this.ridLessFeeOnesIfDoubleSpend(mpTxList);

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
                    outputNoteCommitment1: dummyTx.publicOutput.outputNoteCommitment1.toString(),
                    outputNoteCommitment2: dummyTx.publicOutput.outputNoteCommitment2.toString(),

                    nullifier1: dummyTx.publicOutput.nullifier1.toString(),
                    nullifier2: dummyTx.publicOutput.nullifier2.toString(),
                    dataRoot: dummyTx.publicOutput.dataRoot.toString(),
                    txFee: '0',
                    proof: JSON.stringify(dummyTx.toJSON())
                } as any);
            }
        }

        const totalTxFee = mpTxList.reduce((p, c) => {
            return p + Number(c.txFee)
        }, 0);

        const depositCount = mpTxList.filter(tx => {
            return tx.actionType == ActionType.DEPOSIT.toString();
        }).length;

        // pre insert into tree cache
        let innerRollup_proveTxBatchParamList = await this.preInsertIntoTreeCache(mpTxList);

        this.targetDataRoot = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE, true);
        this.targetNullifierRoot = this.worldStateDB.getRoot(MerkleTreeId.NULLIFIER_TREE, true);
        // insert new data_root
        const dataRootLeafIndex = this.worldStateDB.getNumLeaves(MerkleTreeId.DATA_TREE_ROOTS_TREE, false);
        this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE_ROOTS_TREE, this.targetDataRoot);
        this.targetRootTreeRoot = this.worldStateDB.getRoot(MerkleTreeId.DATA_TREE_ROOTS_TREE, true);

        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();

        // create a new block
        const blockRepo = connection.getRepository(Block);
        let block = new Block();
        block.blockHash = '';// TODO
        block.rollupSize = rollupSize;// TODO non-dummy?
        block.rootTreeRoot0 = this.currentRootTreeRoot.toString();
        block.dataTreeRoot0 = this.currentDataRoot.toString();
        block.nullifierTreeRoot0 = this.currentNullifierRoot.toString();
        block.depositStartIndex0 = this.depositStartIndexInBlock.toString();
        block.rootTreeRoot1 = this.targetRootTreeRoot.toString();
        block.dataTreeRoot1 = this.targetDataRoot.toString();
        block.nullifierTreeRoot1 = this.targetNullifierRoot.toString();
        block.depositStartIndex1 = this.depositEndIndexInBlock.toString();
        block.depositCount = depositCount.toString();
        block.totalTxFees = totalTxFee.toString();
        block = await blockRepo.save(block);// save it

        // del mpL2Tx from memory pool
        const memPlL2TxRepo = connection.getRepository(MemPlL2Tx);
        const mpL2TxIds = nonDummyTxList.map(tx => {
            return tx.id;
        })
        memPlL2TxRepo.delete(mpL2TxIds);

        // update L2Tx and move to L2Tx table
        const l2TxRepo = connection.getRepository(L2Tx);
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
        l2TxRepo.save(nonDummyTxList as L2Tx[]);// insert all!

        // save innerRollupBatch
        const innerRollupBatchRepo = connection.getRepository(InnerRollupBatch);
        const innerRollupBatch = new InnerRollupBatch();
        innerRollupBatch.inputParam = JSON.stringify(innerRollup_proveTxBatchParamList);
        innerRollupBatch.blockId = block.id;
        innerRollupBatchRepo.save(innerRollupBatch);

        // update DepositStatus.CONFIRMED
        const depositCommitmentRepo = connection.getRepository(DepositCommitment);
        const dcCommitments = nonDummyTxList.filter(tx => {
            return tx.actionType == ActionType.DEPOSIT.toString();
        }).map(tx => {
            return tx.outputNoteCommitment1
        })
        depositCommitmentRepo.update({ depositNoteCommitment: In(dcCommitments) }, { status: DepositStatus.CONFIRMED });// TODO imporve here?

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
            batch = batch.concat([
                // L2TX part:
                {
                    key: `L2TX:${tx.outputNoteCommitment1}`,
                    value: tx.txHash
                }, {
                    key: `L2TX:${tx.outputNoteCommitment2}`,
                    value: tx.txHash
                }, {
                    key: `L2TX:${tx.nullifier1}`,
                    value: tx.txHash
                }, {
                    key: `L2TX:${tx.nullifier2}`,
                    value: tx.txHash
                },
                // DataTree part:
                {
                    key: `${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${tx.outputNoteCommitment1}`,
                    value: tx.outputNoteCommitmentIdx1
                }, {
                    key: `${MerkleTreeId[MerkleTreeId.DATA_TREE]}:${tx.outputNoteCommitment2}`,
                    value: tx.outputNoteCommitmentIdx2
                },
                // NullifierTree part:
                {
                    key: `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${tx.nullifier1}`,
                    value: tx.nullifierIdx1
                }, {
                    key: `${MerkleTreeId[MerkleTreeId.NULLIFIER_TREE]}:${tx.nullifier2}`,
                    value: tx.nullifierIdx2
                }]);
        });
        batch.push({
            key: `${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${this.targetRootTreeRoot.toString()}`,
            value: dataRootLeafIndex.toString()
        });
        await this.indexDB.batchInsert(batch);

        // end the flow
        await this.worldState.reset();
    }

    private async preInsertIntoTreeCache(txList: MemPlL2Tx[]) {
        const innerRollup_proveTxBatchParamList: { txId1: number, txId2: number, innerRollupInput: string, joinSplitProof1: string, joinSplitProof2: string }[] = []

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
            this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx1.outputNoteCommitment1));
            dataTreeCursor += 1n;

            const tx1OldDataWitness2: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx1.outputNoteCommitmentIdx2 = dataTreeCursor.toString();
            if (Field(tx1.outputNoteCommitment2).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx1.outputNoteCommitment2));
                dataTreeCursor += 1n;
            }

            // ================ tx2 commitment parts ============
            const tx2OldDataWitness1: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx2.outputNoteCommitmentIdx1 = dataTreeCursor.toString();
            this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx2.outputNoteCommitment1));
            dataTreeCursor += 1n;

            const tx2OldDataWitness2: DataMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE, dataTreeCursor, true);
            tx2.outputNoteCommitmentIdx2 = dataTreeCursor.toString();
            if (Field(tx2.outputNoteCommitment2).equals(DUMMY_FIELD).not().toBoolean()) {// if DUMMY_FIELD, then ignore it!
                this.worldStateDB.appendLeaf(MerkleTreeId.DATA_TREE, Field(tx2.outputNoteCommitment2));
                dataTreeCursor += 1n;
            }

            // ================ tx1 nullifier parts ============
            let nullifierTreeCursor = this.worldStateDB.getNumLeaves(MerkleTreeId.NULLIFIER_TREE, true);

            const tx1LowLeafWitness1: LowLeafWitnessData = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier1), true);
            const tx1OldNullWitness1: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx1.nullifier1).equals(DUMMY_FIELD).not().toBoolean()) {// if DEPOSIT, then ignore it!
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier1))
                tx1.nullifierIdx1 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            }

            const tx1LowLeafWitness2: LowLeafWitnessData = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier2), true);
            const tx1OldNullWitness2: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx1.nullifier2).equals(DUMMY_FIELD).not().toBoolean()) {// if DEPOSIT, then ignore it!
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx1.nullifier2))
                tx1.nullifierIdx2 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            }

            // ================ tx2 nullifier parts ============
            const tx2LowLeafWitness1: LowLeafWitnessData = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier1), true);
            const tx2OldNullWitness1: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx2.nullifier1).equals(DUMMY_FIELD).not().toBoolean()) {// if DEPOSIT, then ignore it!
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier1))
                tx2.nullifierIdx1 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            }

            const tx2LowLeafWitness2: LowLeafWitnessData = await this.worldStateDB.findPreviousValueAndMp(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier2), true);
            const tx2OldNullWitness2: NullifierMerkleWitness = await this.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, nullifierTreeCursor, true);
            if (Field(tx2.nullifier2).equals(DUMMY_FIELD).not().toBoolean()) {// if DEPOSIT, then ignore it!
                await this.worldStateDB.appendLeaf(MerkleTreeId.NULLIFIER_TREE, Field(tx2.nullifier2))
                tx2.nullifierIdx2 = nullifierTreeCursor.toString();
                nullifierTreeCursor += 1n;
            }


            // ================ root tree parts ============
            const tx1DataTreeRootIndex = await this.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${tx1.dataRoot}`);//TODO
            const tx1RootWitnessData: DataRootWitnessData = {
                dataRootIndex: Field(tx1DataTreeRootIndex),
                witness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, tx1DataTreeRootIndex, false)
            };
            const tx2DataTreeRootIndex = await this.indexDB.get(`${MerkleTreeId[MerkleTreeId.DATA_TREE_ROOTS_TREE]}:${tx2.dataRoot}`);//TODO
            const tx2RootWitnessData: DataRootWitnessData = {
                dataRootIndex: Field(tx2DataTreeRootIndex),
                witness: await this.worldStateDB.getSiblingPath(MerkleTreeId.DATA_TREE_ROOTS_TREE, tx2DataTreeRootIndex, false)
            };

            let oldDepositStartIndex = this.depositStartIndexInBlock;
            if (Field(tx1.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                oldDepositStartIndex = Field(tx1.depositIndex);
            } else if (Field(tx2.actionType).equals(ActionType.DEPOSIT).toBoolean()) {
                oldDepositStartIndex = Field(tx2.depositIndex);
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

                depositRoot: this.depositTreeRootInBlock, // if existing depositL2Tx, this will be changed to the latest depositTreeRoot, when rollup-proof gen.
                oldDepositStartIndex
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
        }
        return innerRollup_proveTxBatchParamList;
    }

    /**
     * check if there are some other txs containing the same nullifier1/2, then select the ones with highest txFee.and make the others fail into DB_MemPlL2Tx!!
     * NOTE: this checks must be placed here and cannot be placed at '/receive/tx'.
     */
    private async ridLessFeeOnesIfDoubleSpend(mpTxList: MemPlL2Tx[]) {
        const map = new Map<string, MemPlL2Tx>();
        mpTxList.forEach(tx => {
            const tx1 = map.get(tx.nullifier1);
            if ((Number((tx1?.txFee) ?? '0')) < Number(tx.txFee)) {
                map.set(tx.nullifier1, tx);
            }
            const tx2 = map.get(tx.nullifier2);
            if ((Number((tx2?.txFee) ?? '0')) < Number(tx.txFee)) {
                map.set(tx.nullifier2, tx);
            }
        });
        // rm duplicate
        const set = new Set<MemPlL2Tx>();
        let i = 0;
        let values = map.values();
        while (i < map.size) {
            set.add(values.next().value);
            i++;
        }

        const mpL2TxRepository = getConnection().getRepository(MemPlL2Tx);
        // start a Mysql.transaction
        const queryRunner = mpL2TxRepository.queryRunner!;

        await queryRunner.startTransaction();

        const ridTxList: MemPlL2Tx[] = [];
        mpTxList.forEach(tx => {
            if (!set.has(tx)) {
                tx.status = L2TxStatus.FAILED;
                ridTxList.push(tx);
            }
        });
        mpL2TxRepository.save(ridTxList);

        await queryRunner.commitTransaction();

        return [...set];
    }
}
