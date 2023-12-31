import { Field, Poseidon, PublicKey, Struct, UInt64 } from 'o1js';
import { Commitment } from './commitment';
import { NoteType } from './constants';

export class DataNote
  extends Struct({
    secret: Field,
    ownerPk: PublicKey,
    nanomina: UInt64,
    dataRoot: Field,
  })
  implements Commitment
{
  public commitment(): Field {
    return Poseidon.hash([
      this.secret,
      ...this.ownerPk.toFields(),
      ...this.nanomina.toFields(),
      this.dataRoot,
    ]);
  }

  public static zero(): DataNote {
    return new DataNote({
      secret: Field(0),
      ownerPk: PublicKey.empty(),
      nanomina: UInt64.zero,
      dataRoot: Field(0),
    });
  }
}

export class ValueNote
  extends Struct({
    secret: Field,
    ownerPk: PublicKey,
    accountRequired: Field,
    creatorPk: PublicKey,
    value: UInt64,
    assetId: Field,
    inputNullifier: Field,
    noteType: Field,
  })
  implements Commitment
{
  public commitment(): Field {
    return Poseidon.hash([
      this.secret,
      ...this.ownerPk.toFields(),
      this.accountRequired,
      ...this.creatorPk.toFields(),
      ...this.value.toFields(),
      this.assetId,
      this.inputNullifier,
      this.noteType,
    ]);
  }

  public static zero(): ValueNote {
    return new ValueNote({
      secret: Field(0),
      ownerPk: PublicKey.empty(),
      accountRequired: Field(0),
      creatorPk: PublicKey.empty(),
      value: UInt64.zero,
      assetId: Field(0),
      inputNullifier: Field(0),
      noteType: NoteType.NORMAL,
    });
  }
}
