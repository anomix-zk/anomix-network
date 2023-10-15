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
import { DepositStatus } from "@anomix/types";


@Entity("tb_deposit_commitment")
export class DepositCommitment {
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    depositNoteCommitment: string
    /**
     * leaf index of `depositNoteCommitment` on deposit_tree
     */
    @Column()
    depositNoteIndex: string

    @Column()
    depositValue: string

    /**
     * PublicKey.toBase58
     */
    @Column()
    sender: string

    @Column()
    assetId: string

    /**
     * json string from {@link EncryptedNote}
     */
    @Column()
    encryptedNote: string

    /**
     * L1Tx hash when user deposits
     */
    @Column()
    userDepositL1TxHash: string

    /**
     * L2Tx hash after join-split_deposit circuit
     */
    @Column()
    l2TxHash: string

    /**
     * the status of depositNoteCommitment, reference to {@link DepositStatus}, 
     * * will be updated, when 'markedL1TxHash' or 'l2TxHash' is confirmed, 
     */
    @Column({ default: DepositStatus.PENDING })
    status: number

    /**
     * the primary key of {@link DepositTreeTrans}
     */
    @Column()
    depositTreeTransId: number

    /**
     * the primary key of {@link DepositActionEventFetchRecord}
     */
    @Column()
    depositActionEventFetchRecordId: number


    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date

}
