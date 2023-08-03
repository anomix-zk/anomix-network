import exp from "constants";

export class Tree {
    static get DEPOSIT_TREE(): string {
        return 'deposit_tree'
    }

    static get NULLIFIER_TREE(): string {
        return 'nullifier_tree'
    }

    static get DATA_TREE(): string {
        return 'data_tree'
    }

    static get ROOT_TREE(): string {
        return 'root_tree'
    }

    static get USER_NULLIFIER_TREE(): string {
        return 'user_nullifier_tree'
    }
}


export class BlockStatus {
    /**
     * before L1Tx is confirmed
     */
    static get PENDING(): number {
        return 1;
    }
    /**
     * when L1Tx is confirmed
     */
    static get CONFIRMED(): number {
        return 2;
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

export enum SequencerStatus {
    NotAtRollup = 0,
    AtRollup = 1
}


