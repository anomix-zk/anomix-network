import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

@Entity("tb_deposit_processor_signal")
export class DepositProcessorSignal {
    @PrimaryGeneratedColumn("increment")
    id: number

    /**
     * * DepositProcessorSignal.CAN_TRIGGER_CONTRACT,
     * * DepositProcessorSignal.CAN_NOT_TRIGGER_CONTRACT,
     */
    @Column()
    signal: number

    @Column()
    type: number

    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date
}
