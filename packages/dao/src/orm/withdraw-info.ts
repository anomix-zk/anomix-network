import {
    Column,
    PrimaryGeneratedColumn,
    Entity
} from 'typeorm'

/**
 * record all value note's fields for withdraw
 */
@Entity("tb_withdraw_info")
export class WithdrawInfo {
    @PrimaryGeneratedColumn("increment")
    id: number

    /**
     * hash of corresponding L2 tx
     */
    @Column()
    l2TxHash: string

    @Column()
    secret: string

    @Column()
    ownerPk: string

    @Column()
    accountRequired: string

    /**
     * could be optional
     */
    @Column()
    creatorPk: string

    @Column()
    value: string

    @Column()
    assetId: string

    @Column()
    inputNullifier: string

    @Column()
    noteType: string
}
