import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

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

/**
 * record all L1_Tx from sequencer, like deposit_tree maintainance, trigger rollup_contract, etc.
 */
@Entity("tb_l1_tx")
export class L1Tx {
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    txHash: string

    @Column()
    status: string
}
