import { PublicKey, Field, UInt32, UInt64, Poseidon } from 'snarkyjs';
import { ActionType, AssetId, JoinSplitOutput } from "@anomix/circuits";
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'
import { createHash } from 'crypto';


export class TxStatus {
    static get FAILED(): number {
        return -1;
    }
    static get PENDING(): number {
        return 0;
    }
    static get PROCESSING(): number {
        return 1;
    }
    static get CONFIRMED(): number {
        return 2;
    }
}

export class InnerRollupIdx {
    static get NOT(): number {
        return -1;
    }
}

export class CircuitL2Tx {
    actionType: Field
    outputNoteCommitment1: Field
    outputNoteCommitment2: Field
    nullifier1: Field
    nullifier2: Field
    publicValue: UInt64
    publicOwner: PublicKey
    publicAssetId: Field
    dataRoot: Field
    txFee: UInt64
    txFeeAssetId: Field
    // deposit
    depositRoot: Field
    depositIndex: Field
    //handledDepositIndex: Field

    static zero() {
        return {} as CircuitL2Tx;
    }

    hash(): Field {
        // TODO
        return Field(1);
    }
}

@Entity("l2_tx")
export class L2Tx {
    @PrimaryGeneratedColumn("increment")
    id: number

    @Column()
    actionType: string

    @Column()
    nullifier1: string
    @Column()
    nullifier1_idx: string

    @Column()
    nullifier2: string
    @Column()
    nullifier2_idx: string

    @Column()
    outputNoteCommitment1: string
    @Column()
    outputNoteCommitment1_idx: string

    @Column()
    outputNoteCommitment2: string
    @Column()
    outputNoteCommitment2_idx: string

    @Column()
    publicValue: string
    @Column()
    publicOwner: string
    @Column()
    publicAssetId: string

    @Column()
    dataRoot: string
    @Column()
    depositRoot: string
    @Column()
    depositIndex: string

    @Column()
    txFee: string
    @Column()
    txFeeAssetId: string

    @Column()
    proof: string

    @Column()
    secret: string
    @Column()
    creator_pubkey: string

    @Column()
    encryptedData: string

    @Column({ default: TxStatus.PENDING })
    status: number

    /* TODO
        @OneToOne(
            type => User,
            user => user.paycard,
            {
                onDelete: "CASCADE"
            }
        )
        @JoinColumn()
        commonUserTxWrapper: any
    */

    @Column()
    idxInInnerRollup: number

    @Column({ default: InnerRollupIdx.NOT })
    innerRollupEntityId: string

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    toCircuitType() {
        return new CircuitL2Tx();
    }

    static fromCircuitType(
        joinSplitOutput: JoinSplitOutput
    ) {
        const tx = new L2Tx();
        tx.actionType = joinSplitOutput.actionType.toString();
        tx.nullifier1 = joinSplitOutput.nullifier1.toString();
        tx.nullifier2 = joinSplitOutput.nullifier2.toString();
        tx.outputNoteCommitment1 = joinSplitOutput.outputNoteCommitment1.toString();
        tx.outputNoteCommitment2 = joinSplitOutput.outputNoteCommitment2.toString();
        tx.publicValue = joinSplitOutput.publicValue.toString();
        tx.publicOwner = joinSplitOutput.publicOwner.toBase58();
        tx.publicAssetId = joinSplitOutput.publicAssetId.toString();
        tx.dataRoot = joinSplitOutput.dataRoot.toString();
        tx.txFee = joinSplitOutput.txFee.toString();
        tx.txFeeAssetId = joinSplitOutput.txFeeAssetId.toString();
        tx.secret = joinSplitOutput.secret.toString();
        tx.creator_pubkey = joinSplitOutput.creator_pubkey.toBase58();
        tx.proof = joinSplitOutput.proof;
    }

    /**
     * get tx id
     */
    @Column()
    get txId(): string {
        return Poseidon.hash([
            ...new UInt32(this.actionType).toFields(),
            Field(this.nullifier1),
            Field(this.nullifier2),
            Field(this.outputNoteCommitment1),
            Field(this.outputNoteCommitment2),
            ...new UInt64(this.publicValue).toFields(),
            ...PublicKey.fromBase58(this.publicOwner).toFields(),
            ...new UInt32(this.publicAssetId).toFields(),
            Field(this.dataRoot),
            Field(this.depositRoot),
            ...new UInt32(this.txFee).toFields(),
            ...PublicKey.fromBase58(this.creator_pubkey).toFields(),
            Field(this.secret),
            Field(createHash('sha256').update(this.proof).digest('hex'))
        ]).toString();
    }

    static zeroL2Tx() {
        return L2Tx.fromCircuitType(
            JoinSplitOutput.zero()
        );
    }
}
