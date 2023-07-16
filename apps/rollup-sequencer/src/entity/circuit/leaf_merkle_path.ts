import { ValueNote } from './value_note.js';
import { AbstractMerklePath, LeafHash } from '../merkle_path.js';
import { Field, UInt32, Provable, Poseidon } from 'snarkyjs';
import { AccountNote, AliasViewKey } from './account.js';
import { ProofId } from './index.js';

export class RootTreeLeaf implements LeafHash {
    value: Field;

    hash(): Field {
        return Poseidon.hash([this.value]);
    }
}

export class DataTreeLeaf implements LeafHash {
    proofId: UInt32;
    accountNote: AccountNote;
    valueNote: ValueNote;

    hash(): Field {
        const acctNoteHash = this.accountNote.commitment();
        const valueNoteHash = this.valueNote.commitment();
        return Provable.switch(
            [
                this.proofId.equals(ProofId.DEPOSIT),
                this.proofId.equals(ProofId.TRANSFER),
                this.proofId.equals(ProofId.WITHDRAW),
                this.proofId.equals(ProofId.ACCOUNT),
            ],
            Field,
            [valueNoteHash, valueNoteHash, valueNoteHash, acctNoteHash]
        );
    }

}

export class NullifierTreeLeafValue {
    proofId: UInt32;
    aliasViewKey: AliasViewKey;
    valueNote: ValueNote;

    hash(): Field {
        const aliasViewKeyHash = this.aliasViewKey.nullify();
        const valueNoteHash = this.valueNote.nullify();
        return Provable.switch(
            [
                this.proofId.equals(ProofId.DEPOSIT),
                this.proofId.equals(ProofId.TRANSFER),
                this.proofId.equals(ProofId.WITHDRAW),
                this.proofId.equals(ProofId.ACCOUNT),
            ],
            Field,
            [valueNoteHash, valueNoteHash, valueNoteHash, aliasViewKeyHash]
        );
    }
}

export class NullifierTreeLeaf implements LeafHash {
    value: NullifierTreeLeafValue;
    nextIndex: UInt32;
    nextValue: Field;

    hash(): Field {
        return Poseidon.hash([this.value.hash(), ...this.nextIndex.toFields(), this.nextValue]);
    }
}

export class RootTreeMerklePath extends AbstractMerklePath {
    readonly data: RootTreeLeaf;
}

export class DataTreeMerklePath extends AbstractMerklePath {
    readonly data: DataTreeLeaf;
}

export class NullifierTreeMerklePath extends AbstractMerklePath {
    readonly data: NullifierTreeLeaf;
}
