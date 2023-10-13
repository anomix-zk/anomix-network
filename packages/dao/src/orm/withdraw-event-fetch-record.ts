import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

/**
 * record each time fetching actions/events 
 */
@Entity("tb_withdraw_event_fetch_record")
export class WithdrawEventFetchRecord {
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    data: string

    /**
     * refer to : WithdrawEventFetchRecordStatus.SYNC/NOT_SYNC
     */
    @Column()
    status: number

    /**
     * record the starting block number where obtaining actions/events
     * 
     */
    @Column()
    startBlock: number

    /**
     * record the ending block number where obtaining actions/events
     */
    @Column()
    endBlock: number

    /**
     * just record
     */
    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    /**
     * the timestamp when L2Block is created at Layer2
     */
    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date
}
