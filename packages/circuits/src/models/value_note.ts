import {
  Encryption,
  Field,
  Group,
  Poseidon,
  PrivateKey,
  Provable,
  PublicKey,
  Struct,
  UInt64,
} from 'snarkyjs';
import { Commitment } from './commitment';
import { NoteType } from './constant';

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
  commitment(): Field {
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

  // nullify(accountPrivateKey: PrivateKey): Field {
  //   return Poseidon.hash([
  //     this.commitment(), //!!TODO 是否需要优化?如加入AccountViewing_PrivateKey增强随机性
  //     this.secret,
  //     ...this.ownerPk.toFields(),
  //     ...this.accountRequired.toFields(),
  //     ...this.creatorPk.toFields(),
  //     ...this.value.toFields(),
  //     ...this.assetId.toFields(),
  //     this.inputNullifier,
  //     ...this.noteType.toFields(),
  //   ]);
  // }

  encrypt(): EncryptedValueNote {
    let newFields = ValueNote.toFields(this).slice();

    const cipherText = Encryption.encrypt(newFields, this.ownerPk);
    return new EncryptedValueNote({
      pubkey: cipherText.publicKey,
      cipherText: cipherText.cipherText,
    });
  }
  /**
   *
   * @param asset_id
   * @param account_required
   */
  static zero(): ValueNote {
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

const CIPHER_TEXT_LENGTH = ValueNote.sizeInFields() + 1;

export class EncryptedValueNote extends Struct({
  pubkey: Group,
  cipherText: Provable.Array(Field, CIPHER_TEXT_LENGTH),
}) {
  decrypt(ownerPrivateKey: PrivateKey): ValueNote {
    let newCipherText: Field[] = this.cipherText.slice();

    const decryptedFields = Encryption.decrypt(
      { publicKey: this.pubkey, cipherText: newCipherText },
      ownerPrivateKey
    );

    return ValueNote.fromFields(decryptedFields) as ValueNote;
  }
}
