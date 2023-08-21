import { L1TxStatus } from '@anomix/types'
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'

/**
 * each {@link DepositTreeTrans} has a DepositProverOutput.<br>
 *  save the result in case the flow unexpectedly ends after sending to 'ProofGenerator', 
 *  like 'ProofGenerator' crashes and lost the returning proof, then cannot gen L1Tx to sync with contract.
 *  if the worst case, timing-task will help re-start the flow and trigger gen L1Tx to sync with contract.
 */
@Entity("tb_deposit_prover_output")
export class DepositProverOutput {
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    transId: number

    @Column()
    output: string


    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date

    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date
}
