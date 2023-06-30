import { PublicKey, Field, UInt64, UInt32, Poseidon } from 'snarkyjs';
import { CommitmentNullifier } from '../commitment_nullifier.js';
import { AssetId, AccountRequired } from '.';

export class ValueNote implements CommitmentNullifier {
    constructor(
        readonly secret: Field,
        readonly owner_pubkey: PublicKey,
        readonly account_required: UInt32,
        readonly creator_pubkey: PublicKey,
        readonly value: UInt64,
        readonly asset_id: UInt32,
        readonly input_nullifier: Field
    ) { }

    commitment(): Field {
        return Poseidon.hash([
            this.secret,
            ...this.owner_pubkey.toFields(),
            ...this.account_required.toFields(),
            ...this.creator_pubkey.toFields(),
            ...this.value.toFields(),
            ...this.asset_id.toFields(),
            this.input_nullifier,
        ]);
    }

    nullify(): Field {
        return Poseidon.hash([
            this.commitment(), //!!TODO 是否需要优化?如加入AccountViewing_PrivateKey增强随机性
            this.secret,
            ...this.owner_pubkey.toFields(),
            ...this.account_required.toFields(),
            ...this.creator_pubkey.toFields(),
            ...this.value.toFields(),
            ...this.asset_id.toFields(),
            this.input_nullifier
        ]);
    }

    /**
     * 
     * @param asset_id 
     * @param account_required 
     */
    static zeroValueNote(asset_id: UInt32, account_required: UInt32): ValueNote {
        return new ValueNote(
            Field(0),
            PublicKey.empty(),
            account_required,
            PublicKey.empty(),
            UInt64.zero,
            asset_id,
            Field(0)
        );
    }
}

export const MINA_ACCTREQ_ZERO_VALUE_NOTE = ValueNote.zeroValueNote(AssetId.MINA, AccountRequired.REQUIRED);

export const MINA_NOTACCTREQ_ZERO_VALUE_NOTE = ValueNote.zeroValueNote(
    AssetId.MINA,
    AccountRequired.NOTREQUIRED
);
