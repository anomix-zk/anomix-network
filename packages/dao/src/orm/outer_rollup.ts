import { Field, UInt32, UInt64, PublicKey } from 'snarkyjs';
import {
    Column,
    CreateDateColumn,
    Entity,
    Index, OneToOne, PrimaryGeneratedColumn,
    UpdateDateColumn,
    VersionColumn,
    BeforeInsert,
    JoinColumn,
    OneToMany
} from 'typeorm'
import { InnerRollupEntity } from './inner_rollup';

export class OuterRollupStatus {
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

@Entity('outer_rollup')
export class OuterRollupEntity {
    @PrimaryGeneratedColumn("increment")
    id!: number

    @Column()
    outerRollupId!: string

    @Column()
    outerRollupSize!: number;

    @Column()
    rootTreeRoot0!: string

    @Column()
    rootTreeRoot1!: string

    @Column()
    dataTreeRoot0!: string

    @Column()
    nullifierTreeRoot0!: string

    @Column()
    dataTreeRoot1!: string

    @Column()
    nullifierTreeRoot1!: string

    @Column({ default: OuterRollupStatus.PENDING })
    status!: number

    @OneToMany(() => InnerRollupEntity, (innerRollupEntity) => innerRollupEntity.outerRollupEntityId)
    innerRollupEntityList!: InnerRollupEntity[]

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn({
        default: () => 'CURRENT_TIMESTAMP',
    })
    updatedAt!: Date
}

/*
export class OuterRollupEntity {
    outerRollupId: Field;

    outerRollupSize: UInt32;

    rootTreeRoot0: Field;
    rootTreeRoot1: Field;

    dataTreeRoot0: Field;
    nullifierTreeRoot0: Field;

    dataTreeRoot1: Field;
    nullifierTreeRoot1: Field;

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

    rollupBeneficiary: PublicKey;

    proof: any;
}
*/
