import { PublicKey, Field, Poseidon } from 'snarkyjs';
import { CommitmentNullifier } from '../commitment_nullifier';

export class Alias implements CommitmentNullifier {
    constructor(readonly value: Field) { }

    commitment(): Field {
        Field(0).assertEquals(Field(1));// no need for data_tree
        return Field(0);
    }

    nullify(): Field {
        return Poseidon.hash([this.value]);
    }

    static zeroAlias(): Alias {
        return new Alias(Field(0));
    }
}

export class AccountViewKey implements CommitmentNullifier {
    constructor(readonly value: PublicKey) { }

    commitment(): Field {
        Field(0).assertEquals(Field(1));// no need for data_tree
        return Field(0);
    }

    nullify(): Field {
        return Poseidon.hash(this.value.toFields());
    }

    static zeroAccountViewKey(): AccountViewKey {
        return new AccountViewKey(PublicKey.empty());
    }
}

/**
 *
 * * alias_nullifier = hash(hash('name'), hash(zeroAccountViewKey))
 * * accountViewKey_nullifier = hash(hash(zeroAlias), hash(accountViewKey)),
 * 
 */
export class AliasViewKey implements CommitmentNullifier {
    constructor(readonly alias: Alias, readonly accountViewKey: AccountViewKey) { }

    commitment(): Field {
        Field(0).assertEquals(Field(1));// no need for data_tree
        return Field(0);
    }

    nullify(): Field {
        return Poseidon.hash([this.alias.nullify(), this.accountViewKey.nullify()]);
    }

    static zeroAccountViewKey(): AliasViewKey {
        return new AliasViewKey(Alias.zeroAlias(), AccountViewKey.zeroAccountViewKey());
    }
}

export class AccountNote implements CommitmentNullifier {
    constructor(readonly aliasHash: Field, readonly acctPk: PublicKey, readonly spendingPk: PublicKey) { }

    commitment(): Field {
        return Poseidon.hash([this.aliasHash, ...this.acctPk.toFields(), ...this.spendingPk.toFields()]);
    }

    nullify(): Field {
        Field(0).assertEquals(Field(1)); // no need for nullifier_tree
        return Field(0);
    }

    static zeroAccountNote() { // TODO 待研究PublicKey.empty()是什么?
        return new AccountNote(Field(0), PublicKey.empty(), PublicKey.empty());
    }
}
