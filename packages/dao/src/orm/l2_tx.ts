import { PublicKey, Field, UInt32, UInt64, Poseidon } from 'snarkyjs';
import { MINA_NOTACCTREQ_ZERO_VALUE_NOTE, ActionType, AssetId } from "@anomix/circuits";
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
    readonly action_type: UInt32
    readonly input_note_nullifier_A: Field
    readonly input_note_nullifier_B: Field
    readonly output_note_commitment_C: Field
    readonly output_note_commitment_D: Field
    readonly public_value: UInt64
    readonly public_owner: PublicKey
    readonly asset_id: UInt32
    readonly data_tree_root: Field
    readonly nullifier_tree_root: Field
    readonly tx_fee: UInt32
    readonly proof: any// TODO need join-split circuit first
    readonly secret: Field
    readonly creator_pubkey: PublicKey

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
    action_type: string

    @Column()
    input_note_nullifier_A: string
    @Column()
    nullifier_idx_A: string

    @Column()
    input_note_nullifier_B: string
    @Column()
    nullifier_idx_B: string

    @Column()
    output_note_commitment_C: string
    @Column()
    commitment_idx_C: string

    @Column()
    output_note_commitment_D: string
    @Column()
    commitment_idx_D: string

    @Column()
    public_value: string
    @Column()
    public_owner: string
    @Column()
    asset_id: string

    @Column()
    data_tree_root: string
    @Column()
    nullifier_tree_root: string

    @Column()
    tx_fee: string
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

    static circuit2primitive(
        circuitL2tx: {
            action_type: UInt32,
            input_note_nullifier_A: Field,
            input_note_nullifier_B: Field,
            output_note_commitment_C: Field,
            output_note_commitment_D: Field,
            public_value: UInt64,
            public_owner: PublicKey,
            asset_id: UInt32,
            data_tree_root: Field,
            nullifier_tree_root: Field,
            tx_fee: UInt32,
            proof: string,
            secret: Field,
            creator_pubkey: PublicKey
        }
    ) {
        const tx = new L2Tx();
        tx.action_type = circuitL2tx.action_type.toString();
        tx.input_note_nullifier_A = circuitL2tx.input_note_nullifier_A.toString();
        tx.input_note_nullifier_B = circuitL2tx.input_note_nullifier_B.toString();
        tx.output_note_commitment_C = circuitL2tx.output_note_commitment_C.toString();
        tx.output_note_commitment_D = circuitL2tx.output_note_commitment_D.toString();
        tx.public_value = circuitL2tx.public_value.toString();
        tx.public_owner = circuitL2tx.public_owner.toBase58();
        tx.asset_id = circuitL2tx.asset_id.toString();
        tx.data_tree_root = circuitL2tx.data_tree_root.toString();
        tx.nullifier_tree_root = circuitL2tx.nullifier_tree_root.toString();
        tx.tx_fee = circuitL2tx.tx_fee.toString();
        tx.secret = circuitL2tx.secret.toString();
        tx.creator_pubkey = circuitL2tx.creator_pubkey.toBase58();
        tx.proof = circuitL2tx.proof;
    }

    /**
     * get tx id
     */
    @Column()
    get txId(): string {
        return Poseidon.hash([
            ...new UInt32(this.action_type).toFields(),
            Field(this.input_note_nullifier_A),
            Field(this.input_note_nullifier_B),
            Field(this.output_note_commitment_C),
            Field(this.output_note_commitment_D),
            ...new UInt64(this.public_value).toFields(),
            ...PublicKey.fromBase58(this.public_owner).toFields(),
            ...new UInt32(this.asset_id).toFields(),
            Field(this.data_tree_root),
            Field(this.nullifier_tree_root),
            ...new UInt32(this.tx_fee).toFields(),
            ...PublicKey.fromBase58(this.creator_pubkey).toFields(),
            Field(this.secret),
            Field(createHash('sha256').update(this.proof).digest('hex'))
        ]).toString();
    }

    static zeroL2Tx(data_tree_root: Field, nullifier_tree_root: Field) {
        return L2Tx.circuit2primitive(
            {
                action_type: ActionType.PADDING,
                input_note_nullifier_A: MINA_NOTACCTREQ_ZERO_VALUE_NOTE.nullify(),
                input_note_nullifier_B: MINA_NOTACCTREQ_ZERO_VALUE_NOTE.nullify(),
                output_note_commitment_C: MINA_NOTACCTREQ_ZERO_VALUE_NOTE.commitment(),
                output_note_commitment_D: MINA_NOTACCTREQ_ZERO_VALUE_NOTE.commitment(),
                public_value: UInt64.zero,
                public_owner: PublicKey.empty(),
                asset_id: AssetId.MINA,
                data_tree_root,
                nullifier_tree_root,
                tx_fee: UInt32.zero,
                proof: '',// TODO proof, joint-split? emptyProof?
                secret: Field(0),
                creator_pubkey: PublicKey.empty()
            }
        );
    }
}
