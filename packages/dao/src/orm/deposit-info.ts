/**
 * 记录 (actions,  events) 对应的notecommitment, 以及状态
 */
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

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

@Entity("tb_deposit_info")
export class DepositInfo {
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    noteCommitment: string

    @Column()
    noteCommitment_idx: string // 待定

    @Column()
    l1TxId: string

    @Column()
    depositValue: string

    @Column()
    sender: string

    @Column()
    assetId: string

    @Column()
    encryptedNote: string

    @Column({ default: DepositStatus.PENDING })
    status: number

    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date

}
