import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

/**
 * record all L1_Tx from sequencer, like deposit_tree root maintainance, trigger rollup_contract, etc.
 */
@Entity("tb_deposit_tree_trans")
export class DepositTreeTrans {
    @PrimaryGeneratedColumn("increment")
    id: number

    /**
     * L1TxHash
     */
    @Column()
    txHash: string

    @Column()
    status: string

    @Column()
    txType: string

}