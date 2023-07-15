import { Field, Poseidon, PublicKey, Struct, UInt32, UInt64 } from 'snarkyjs';
import { CommitmentNullifier } from './commitment_nullifier';
import { AccountRequired, AssetId, NoteType } from './constant';

export class ValueNote
    extends Struct({
        secret: Field,
        owner_pubkey: PublicKey,
        account_required: UInt32,
        creator_pubkey: PublicKey,
        value: UInt64,
        asset_id: UInt32,
        input_nullifier: Field,
        note_type: UInt32,
    })
    implements CommitmentNullifier {
    commitment(): Field {
        return Poseidon.hash([
            this.secret,
            ...this.owner_pubkey.toFields(),
            ...this.account_required.toFields(),
            ...this.creator_pubkey.toFields(),
            ...this.value.toFields(),
            ...this.asset_id.toFields(),
            this.input_nullifier,
            ...this.note_type.toFields(),
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
            this.input_nullifier,
            ...this.note_type.toFields(),
        ]);
    }

    /**
     *
     * @param asset_id
     * @param account_required
     */
    static zero(
        asset_id: UInt32,
        account_required: UInt32,
        secret: Field = Field.random()
    ): ValueNote {
        return new ValueNote({
            secret,
            owner_pubkey: PublicKey.empty(),
            account_required,
            creator_pubkey: PublicKey.empty(),
            value: UInt64.zero,
            asset_id,
            input_nullifier: Field(0),
            note_type: NoteType.NORMAL,
        });
    }
}

export const MINA_ACCTREQ_ZERO_VALUE_NOTE = ValueNote.zero(
    AssetId.MINA,
    AccountRequired.REQUIRED
);

export const MINA_NOTACCTREQ_ZERO_VALUE_NOTE = ValueNote.zero(
    AssetId.MINA,
    AccountRequired.NOTREQUIRED
);
