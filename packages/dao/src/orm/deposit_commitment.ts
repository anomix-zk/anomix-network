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
     * entity id of corresponding L2 tx, when account registration(join-split circuit)
     */
    @Column()
    l2TxId: number

    /**
     * L2Tx hash after account registration(join-split circuit)
     */
    @Column()
    l2TxHash: string

    /**
     * the status of depositNoteCommitment, reference to {@link DepositStatus}, 
     * * will be updated, when 'markedL1TxHash' or 'l2TxHash' is confirmed, 
     */
    @Column({ default: DepositStatus.PENDING })
    depositStatus: number

    /**
     * L1Tx hash when being marked on 'Deposit_Tree', {@link DepositTreeTrans}
     */
    markedL1TxHash: string

    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date

}
