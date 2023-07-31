export class Tree {
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
