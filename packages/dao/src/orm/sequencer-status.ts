import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

@Entity("tb_seq_status")
export class SeqStatus {
    @PrimaryGeneratedColumn("increment")
    id: number

    /**
     * * NotAtRollup = 0,
     * * AtRollup = 1
     */
    @Column()
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
