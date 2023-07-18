import { L2Tx } from './l2_tx.js';
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
export class InnerRollupEntity {
    @PrimaryGeneratedColumn("increment")
    id!: number

    @Column()
    innerRollupId!: string;

    @Column()
    innerRollupSize!: number; // indicate the number of non-padding tx,

    @Column()
    rootTreeRoot0!: string;

    @Column()
    dataTreeRoot0!: string;

    @Column()
    nullifierTreeRoot0!: string;

    @Column()
    resultingDataRreeRoot!: string;

    @Column()
    resultingNullifierTreeRoot!: string;

    @Column()
    totalTxFee!: string

    @Column()
    proof!: string

    @Column({ default: InnerRollupStatus.PENDING })
    status!: number

    @OneToMany(() => L2Tx, (tx) => tx.innerRollupEntityId)
    txList!: L2Tx[]

    @Column()
    idxInOuterRollup!: number

    @Column()
    outerRollupEntityId!: number

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt!: Date
}
/*
export class InnerRollupEntity {
    innerRollupId: Field;

    innerRollupSize: UInt32; // indicate the number of non-padding tx,

    rootTreeRoot0: Field;

    dataTreeRoot0: Field;
    nullifierTreeRoot0: Field;

    resultingDataRreeRoot: Field;
    resultingNullifierTreeRoot: Field;

    totalTxFee: [
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },

        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },

        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },

        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 },
        { assetId: UInt32; totalTxFee: UInt64 }
    ]; // 需要优化，如固定数组为20个, assetId从0递增？

    txIds: [Field, Field, Field, Field, Field, Field, Field, Field]; //fixed number, [inner_rollup_count] TODO 为了让任何人按序重建merkle tree

    proof: any;
}
 */
