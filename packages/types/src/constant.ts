export class BlockStatus {
    /**
     * before BlockProver.prove(*)
     */
    static get PENDING(): number {
        return 1;
    }

    /**
     * after BlockProver.prove(*) && before L1Tx is confirmed
     */
    static get PROVED(): number {
        return 2;
    }

    /**
     * after L1Tx is confirmed
     */
    static get CONFIRMED(): number {
        return 3;
    }
}

export class DepositStatus {
    /**
     * initial status
     */
    static get PENDING(): number {
        return 0;
    }
    /**
     * marked on deposit_tree
     */
    static get MARKED(): number {
        return 1;
    }
    /**
     * during join-split or inner-rollup progress
     */
    static get PROCESSING(): number {
        return 2;
    }
    /**
     * already on data_tree
     */
    static get CONFIRMED(): number {
        return 3;
    }
}

export class L2TxStatus {

    /**
     * when there is another tx in memory pool with the same nullifier1 or nullifier2. Pending txs will be checked and update to 'FAILED' during sequencer rollup.
     */
    static get FAILED(): number {
        return -1;
    }

    /**
     * initial
     */
    static get PENDING(): number {
        return 0;
    }

    /**
     * before L2Block where l2tx is included is created
     */
    static get PROCESSING(): number {
        return 1;
    }

    /**
     * L2Block where l2tx is included is created
     */
    static get CONFIRMED(): number {
        return 2;
    }
}

export class WithdrawNoteStatus {
    /**
     * its initial status
     */
    static get PENDING() {
        return 0;
    }

    /**
     * when it's claimed
     */
    static get PROCESSING() {
        return 1;
    }

    /**
     * when L1Tx is confirmed
     */
    static get DONE() {
        return 2;
    }
}

export class L1TxStatus {
    static get FAILED(): number {
        return -1;
    }
    static get PROCESSING(): number {
        return 1;
    }
    static get CONFIRMED(): number {
        return 2;
    }
}

export enum DepositTreeTransStatus {
    PROCESSING,
    PROVED,
    CONFIRMED
}

export enum DepositProcessingSignal {
    CAN_TRIGGER_CONTRACT,
    CAN_NOT_TRIGGER_CONTRACT
}

export enum SequencerStatus {
    NotAtRollup = 0,
    AtRollup = 1
}

export enum FlowTaskType {
    ROLLUP_TX_BATCH = 0,
    ROLLUP_MERGE,
    ROLLUP_TX_BATCH_MERGE,
    BLOCK_PROVE,
    ROLLUP_CONTRACT_CALL,

    DEPOSIT_BATCH,
    DEPOSIT_MERGE,
    DEPOSIT_BATCH_MERGE,
    DEPOSIT_UPDATESTATE
}

export type FlowTask<T> = {
    flowId: string,
    taskType: FlowTaskType,
    data: T
}

/**
 * Defines the  Merkle tree IDs.
 */
export enum MerkleTreeId {
    DEPOSIT_TREE = 0,
    /**
     * for normal 
     */
    DATA_TREE,
    /**
     * always keep sync with onchain contract's data_tree root. when L2Block is confirmed on Layer1, ie. constract's data_tree root changes, 
     * then persist the coorresponding cached incrementing updates to keep sync with onchain contract's data_tree root.
     * * this tree is for Withdrawal scene currently.
     */
    SYNC_DATA_TREE,
    NULLIFIER_TREE,
    DATA_TREE_ROOTS_TREE,
    USER_NULLIFIER_TREE
}

/**
 * the type of 'BlockCache'
 */
export enum BlockCacheType {
    DATA_TREE_UPDATES,
    TX_FEE_EMPTY_LEAF_WITNESS,
    DATA_TREE_ROOT_EMPTY_LEAF_WITNESS,
}
