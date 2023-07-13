import { Field, Poseidon, PublicKey, Struct } from 'snarkyjs';
import { CommitmentNullifier } from './commitment_nullifier';

export class Alias
  extends Struct({ value: Field })
  implements CommitmentNullifier
{
  commitment(): Field {
    throw new Error('Method not implemented.');
  }

  nullify(): Field {
    return Poseidon.hash([this.value]);
  }

  static zero(): Alias {
    return new Alias({ value: Field(0) });
  }
}

export class AccountViewKey
  extends Struct({
    value: PublicKey,
  })
  implements CommitmentNullifier
{
  commitment(): Field {
    throw new Error('Method not implemented.');
  }

  nullify(): Field {
    return Poseidon.hash(this.value.toFields());
  }

  static zero(): AccountViewKey {
    return new AccountViewKey({ value: PublicKey.empty() });
  }
}

/**
 *
 * * alias_nullifier = hash(hash('name'), hash(ZeroAccountViewKey))
 * * accountViewKey_nullifier = hash(hash(ZeroAlias), hash(accountViewKey)),
 *
 */
export class AliasViewKey
  extends Struct({
    alias: Alias,
    accountViewKey: AccountViewKey,
  })
  implements CommitmentNullifier
{
  commitment(): Field {
    throw new Error('Method not implemented.');
  }

  nullify(): Field {
    return Poseidon.hash([this.alias.nullify(), this.accountViewKey.nullify()]);
  }

  static zero(): AliasViewKey {
    return new AliasViewKey({
      alias: Alias.zero(),
      accountViewKey: AccountViewKey.zero(),
    });
  }
}

export class AccountNote
  extends Struct({ aliasHash: Field, acctPk: PublicKey, spendingPk: PublicKey })
  implements CommitmentNullifier
{
  commitment(): Field {
    return Poseidon.hash([
      this.aliasHash,
      ...this.acctPk.toFields(),
      ...this.spendingPk.toFields(),
    ]);
  }

  nullify(): Field {
    throw new Error('Method not implemented.');
  }

  static zero(): AccountNote {
    return new AccountNote({
      aliasHash: Field(0),
      acctPk: PublicKey.empty(),
      spendingPk: PublicKey.empty(),
    });
  }
}
