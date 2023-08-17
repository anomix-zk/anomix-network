import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    OneToMany
} from 'typeorm'
import { L2Tx } from './l2-tx';
import { BlockStatus } from "@anomix/types";

@Entity('tb_block_prover_output')
export class BlockProverOutput {
    /**
     * i.e. blockHeight, should starts from 1
     */
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    output: string

    @Column()
    blockId: number

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

