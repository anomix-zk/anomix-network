import { EncryptedNote } from '@anomix/types';
import {
  calculateShareSecret,
  decrypt,
  derivePublicKeyBigInt,
  genNewKeyPairForNote,
  recoverReceiverBySender,
} from '@anomix/utils';
import { consola } from 'consola';
import { Field, PrivateKey, PublicKey } from 'o1js';
import { ValueNoteJSON } from '../note/note';

export class NoteDecryptor {
  private log = consola.withTag('anomix:note_decryptor');

  public async decryptNote(
    encryptedNote: EncryptedNote,
    accountPrivateKey: PrivateKey
  ): Promise<{ valueNoteJSON: ValueNoteJSON; isSender: boolean } | undefined> {
    let shareSecret = '';
    let isSender = false;
    const accountKeyBigInt = accountPrivateKey.toBigInt();
    const accountPkBigint = derivePublicKeyBigInt(
      accountPrivateKey.toPublicKey()
    );
    const senderNewKeyPair = genNewKeyPairForNote(
      accountKeyBigInt,
      BigInt(encryptedNote.noteCommitment)
    );
    const senderNewKey = senderNewKeyPair.privateKey;
    const senderNewPubKey58 = senderNewKeyPair.publicKey.toBase58();
    if (senderNewPubKey58 !== encryptedNote.publicKey) {
      // Not a sender, we can only decrypt the note if we are the receiver
      shareSecret = calculateShareSecret(
        accountPrivateKey,
        PublicKey.fromBase58(encryptedNote.publicKey)
      );
    } else {
      // As a sender, we can decrypt the note
      isSender = true;
      const receiverPubKey = recoverReceiverBySender(
        encryptedNote.receiverInfo.map((v) => Field(v)),
        accountPkBigint,
        BigInt(encryptedNote.noteCommitment)
      );
      shareSecret = calculateShareSecret(senderNewKey, receiverPubKey);
    }

    try {
      const valueNoteJSONStr = await decrypt(
        encryptedNote.cipherText,
        encryptedNote.noteCommitment,
        shareSecret
      );
      return {
        valueNoteJSON: JSON.parse(valueNoteJSONStr),
        isSender,
      };
    } catch (err) {
      const error = err as Error;
      this.log.info('decrypt failed message: ', error.message);
      this.log.info('decrypt failed ', error.stack);
    }
  }
}
