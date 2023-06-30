import { UInt32, UInt64, Poseidon } from 'snarkyjs';
import { PublicKey, Field } from 'snarkyjs';
import { MINA_NOTACCTREQ_ZERO_VALUE_NOTE } from "./value_note.js";
import { ProofId, AssetId } from '.';

export class WithdrawInfo {
    constructor(readonly secret: Field, readonly creator_pubkey: PublicKey) { }

    static zeroWithdrawInfo() {
        return new WithdrawInfo(Field(0), PublicKey.empty());
    }
}

export class L2Tx {
    constructor(
        readonly proof_id: UInt32,
        readonly input_note_nullifier_A: Field,
        readonly input_note_nullifier_B: Field,
        readonly output_note_commitment_C: Field,
        readonly output_note_commitment_D: Field,
        readonly public_value: UInt64,
        readonly public_owner: PublicKey,
        readonly asset_id: UInt32,
        readonly data_tree_root: Field,
        readonly nullifier_tree_root: Field,
        readonly tx_fee: UInt32,
        readonly proof: any,// TODO need join-split circuit first
        readonly withdraw_info: WithdrawInfo
    ) { }

    /**
     * get tx id
     */
    get txId(): Field {
        return Poseidon.hash([
            ...this.proof_id.toFields(),
            this.input_note_nullifier_A,
            this.input_note_nullifier_B,
            this.output_note_commitment_C,
            this.output_note_commitment_D,
            ...this.public_value.toFields(),
            ...this.public_owner.toFields(),
            ...this.asset_id.toFields(),
            this.data_tree_root,
            this.nullifier_tree_root,
            ...this.tx_fee.toFields(),
            Field(0),//TODO proof, need join-split circuit first!!
            ...this.withdraw_info.creator_pubkey.toFields(),
            ...this.withdraw_info.secret.toFields()
        ]);
    }

    static zeroL2Tx(data_tree_root: Field, nullifier_tree_root: Field) {
        return new L2Tx(
            ProofId.PADDING,
            MINA_NOTACCTREQ_ZERO_VALUE_NOTE.nullify(),
            MINA_NOTACCTREQ_ZERO_VALUE_NOTE.nullify(),
            MINA_NOTACCTREQ_ZERO_VALUE_NOTE.commitment(),
            MINA_NOTACCTREQ_ZERO_VALUE_NOTE.commitment(),
            UInt64.zero,
            PublicKey.empty(),
            AssetId.MINA,
            data_tree_root,
            nullifier_tree_root,
            UInt32.zero,
            Field(0), //TODO proof, need join-split circuit first！
            WithdrawInfo.zeroWithdrawInfo()
        );
    }
}
