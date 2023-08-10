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
@Entity("tb_deposit_action_event_fetch_record")
export class DepositActionEventFetchRecord {
    @PrimaryGeneratedColumn("increment")
    id: number

    /**
     * current batch's starting actionState
     */
    @Column()
    startActionHash: string

    /**
     * next batch's starting actionState
     */
    @Column()
    nextActionHash: string

    /**
     * current batch's starting actionIndex
     */
    @Column()
    startActionIndex: string

    /**
     * next batch's starting actionIndex
     */
    @Column()
    nextActionIndex: string

    /**
     * record the starting block number where obtaining actions/events
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
