import { UInt32, UInt64 } from 'snarkyjs';
import { PublicKey, Field } from 'snarkyjs';
import { L2Tx as CircuitL2Tx, WithdrawInfo } from './circuit';

export class L2Tx extends CircuitL2Tx {
    constructor(
        proof_id: UInt32,
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
        proof: any,// TODO need join-split circuit first
        withdraw_info: WithdrawInfo,
        readonly encryptedData: string // base64 encoded
    ) {
        super(
            proof_id,
            input_note_nullifier_A,
            input_note_nullifier_B,
            output_note_commitment_C,
            output_note_commitment_D,
            public_value,
            public_owner,
            asset_id,
            data_tree_root,
            nullifier_tree_root,
            tx_fee,
            proof,
            withdraw_info
        );
    }

}
