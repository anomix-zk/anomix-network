import { L2Tx } from './l2-tx-memorypool';
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    OneToMany
} from 'typeorm'

export class InnerRollupStatus {
    static get FAILED(): number {
        return -1;
    }
    static get PENDING(): number {
        return 1;
    }
    static get CONFIRMED(): number {
        return 2;
    }
}

@Entity("inner_rollup")
export class InnerRollupOutputEntity {
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    rollupId: string;

    @Column()
    rollupSize: number; // indicate the number of non-padding tx,

    @Column()
    oldDataRoot: string;

    @Column()
    oldNullRoot: string;

    @Column()
    newDataRoot: string;

    @Column()
    newNullRoot: string;

    @Column()
    dataRootsRoot: string;

    /**
     * json string from: Provable.Array(TxFee, FEE_ASSET_ID_SUPPORT_NUM)
     */
    @Column()
    totalTxFees: string

    @Column()
    depositRoot: string;

    @Column()
    depositCount: string;

    @Column()
    oldDepositStartIndex: string;

    @Column()
    newDepositStartIndex: string;

    @Column()
    proof: string



    @Column({ default: InnerRollupStatus.PENDING })
    status: number

    @OneToMany(() => L2Tx, (tx) => tx.innerRollupOutputEntityId)
    txList: L2Tx[]

    @Column()
    idxInOuterRollup: number

    @Column()
    blockProveOutputEntityId: number

    @CreateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    createdAt: Date

    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date
}

