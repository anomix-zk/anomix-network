import { Alias, Database } from '../database/database';
import { Bool, Field, PrivateKey, PublicKey } from 'snarkyjs';
import { AnomixNode } from '../rollup_node/anomix_node';
import { consola } from 'consola';
import { AssetsInBlockDto } from '@anomix/types';
import { NoteDecryptor } from '../note_decryptor/note_decryptor';
import {
  AccountNote,
  calculateNoteNullifier,
  ValueNote,
} from '@anomix/circuits';
import {
  Note,
  ValueNoteJSON,
  WithdrawInfoDtoToValueNoteJSON,
} from '../note/note';
import { UserPaymentTx } from '../user_tx/user_payment_tx';
import { ActionType } from '@anomix/circuits';
import { UserAccountTx } from '../user_tx/user_account_tx';
import { UserState } from '../user_state/user_state';
import { decryptAlias } from '../note_decryptor/alias_util';

export class NoteProcessor {
  private syncedToBlock = 0;

  constructor(
    public readonly accountPrivateKey: PrivateKey,
    private db: Database,
    private node: AnomixNode,
    private log = consola.withTag('anomix:note_processor')
  ) {}

  public async isSynced(): Promise<boolean> {
    const remoteBlocHeight = await this.node.getBlockHeight();
    return this.syncedToBlock === remoteBlocHeight;
  }

  public async process(l2Blocks: AssetsInBlockDto[]): Promise<void> {
    if (l2Blocks.length === 0) {
      return;
    }
    this.log.info(`Processing ${l2Blocks.length} blocks...`);

    const accountPk = this.accountPrivateKey.toPublicKey().toBase58();
    this.log.info(`Account public key: ${accountPk}`);

    const noteDecryptor = new NoteDecryptor();

    const userState = await this.db.getUserState(accountPk);
    if (userState) {
      this.syncedToBlock = userState.syncedToBlock;
    }

    for (let i = 0; i < l2Blocks.length; i++) {
      const block = l2Blocks[i];
      const txList = block.txList;
      if (this.syncedToBlock >= block.blockHeight) {
        this.log.debug(`Skipping block ${block.blockHeight}`);
        continue;
      }

      for (let j = 0; j < txList.length; j++) {
        const tx = txList[j];
        const outputNote1 = tx.extraData.outputNote1;
        const outputNote2 = tx.extraData.outputNote2;

        let valueNoteJSON1: ValueNoteJSON | undefined = undefined;
        let valueNoteJSON2: ValueNoteJSON | undefined = undefined;
        let isSenderForTx = false;

        if (tx.actionType === ActionType.ACCOUNT.toString()) {
          this.log.debug(`Processing account tx: ${tx.txHash}`);

          if (accountPk === tx.extraData.accountPublicKey) {
            this.log.debug(`Account tx is for this account: ${accountPk}`);
            let alias: string | undefined = undefined;

            if (tx.extraData.aliasInfo) {
              alias = await decryptAlias(
                tx.extraData.aliasInfo,
                tx.extraData.aliasHash!,
                this.accountPrivateKey
              );

              // update user state
              let userState = await this.db.getUserState(accountPk);
              if (userState && userState.alias === undefined) {
                userState.alias = alias;
                await this.db.upsertUserState(userState);
              }
            }

            await this.db.upsertUserAccountTx(
              UserAccountTx.from({
                txHash: tx.txHash,
                accountPk: accountPk,
                aliasHash: tx.extraData.aliasHash!,
                alias,
                newSigningPk1: undefined,
                newSigningPk2: undefined,
                txFee: tx.txFee,
                txFeeAssetId: tx.txFeeAssetId,
                // TODO: migrated default false
                migrated: false,
                createdTs: block.createdTs,
                finalizedTs: block.finalizedTs,
              })
            );

            const signingKeys = await this.db.getSigningKeys(accountPk);
            if (signingKeys.length > 0) {
              const signingKey1 = signingKeys.find(
                (sk) =>
                  new AccountNote({
                    aliasHash: Field(tx.extraData.aliasHash!),
                    acctPk: PublicKey.fromBase58(sk.accountPk),
                    signingPk: PublicKey.fromBase58(sk.signingPk),
                  })
                    .commitment()
                    .toString() === tx.outputNoteCommitment1
              );
              const signingKey2 = signingKeys.find(
                (sk) =>
                  new AccountNote({
                    aliasHash: Field(tx.extraData.aliasHash!),
                    acctPk: PublicKey.fromBase58(sk.accountPk),
                    signingPk: PublicKey.fromBase58(sk.signingPk),
                  })
                    .commitment()
                    .toString() === tx.outputNoteCommitment2
              );
              if (signingKey1) {
                await this.db.addAlias(
                  new Alias(
                    tx.extraData.aliasHash!,
                    accountPk,
                    Number(tx.outputNoteCommitmentIdx1),
                    tx.outputNoteCommitment1,
                    signingKey1.signingPk
                  )
                );
              }
              if (signingKey2) {
                await this.db.addAlias(
                  new Alias(
                    tx.extraData.aliasHash!,
                    accountPk,
                    Number(tx.outputNoteCommitmentIdx2),
                    tx.outputNoteCommitment2,
                    signingKey2.signingPk
                  )
                );
              }
            } else {
              await this.db.addAlias(
                new Alias(
                  tx.extraData.aliasHash!,
                  accountPk,
                  Number(tx.outputNoteCommitmentIdx1),
                  tx.outputNoteCommitment1
                )
              );
              await this.db.addAlias(
                new Alias(
                  tx.extraData.aliasHash!,
                  accountPk,
                  Number(tx.outputNoteCommitmentIdx2),
                  tx.outputNoteCommitment2
                )
              );
            }
          }
        } else if (tx.actionType === ActionType.WITHDRAW.toString()) {
          this.log.debug(`Processing withdraw tx: ${tx.txHash}`);
          const inputNote1 = await this.db.getNoteByNullifier(tx.nullifier1);
          if (inputNote1 && inputNote1.ownerPk === accountPk) {
            const withdrawNote = WithdrawInfoDtoToValueNoteJSON(
              tx.extraData.withdrawNote!
            );
            const valueNote = ValueNote.fromJSON(withdrawNote) as ValueNote;
            const commitment = valueNote.commitment();
            const nullifier = calculateNoteNullifier(
              commitment,
              this.accountPrivateKey,
              Bool(true)
            ).toString();
            await this.db.addNote(
              Note.from({
                valueNoteJSON: withdrawNote,
                commitment: commitment.toString(),
                nullifier,
                nullified: false,
                index: Number(
                  tx.extraData.withdrawNote?.outputNoteCommitmentIdx
                ),
              })
            );

            await this.db.upsertUserPaymentTx(
              UserPaymentTx.from({
                txHash: tx.txHash,
                accountPk: accountPk,
                actionType: tx.actionType,
                publicValue: tx.publicValue,
                publicAssetId: tx.publicAssetId,
                publicOwner: tx.publicOwner,
                txFee: tx.txFee,
                txFeeAssetId: tx.txFeeAssetId,
                depositRoot: tx.depositRoot!,
                depositIndex: Number(tx.depositIndex!),
                privateValue: withdrawNote.value,
                privateValueAssetId: withdrawNote.assetId,
                sender: accountPk,
                receiver: withdrawNote.ownerPk,
                isSender: true,
                createdTs: block.createdTs,
                finalizedTs: block.finalizedTs,
              })
            );
          }
        } else {
          // deposit and send
          this.log.debug(`Processing deposit or send tx: ${tx.txHash}`);

          const decryptedResult1 = await noteDecryptor.decryptNotes(
            outputNote1!,
            this.accountPrivateKey
          );
          if (decryptedResult1) {
            valueNoteJSON1 = decryptedResult1.valueNoteJSON;
            isSenderForTx = decryptedResult1.isSender;
            if (!decryptedResult1.isSender) {
              const outputNote1Nullifier = calculateNoteNullifier(
                Field(outputNote1!.noteCommitment),
                this.accountPrivateKey,
                Bool(true)
              );
              await this.db.addNote(
                Note.from({
                  valueNoteJSON: decryptedResult1.valueNoteJSON,
                  commitment: outputNote1!.noteCommitment,
                  nullifier: outputNote1Nullifier.toString(),
                  nullified: false,
                  index: Number(tx.outputNoteCommitmentIdx1),
                })
              );
            }

            if (outputNote2) {
              const decryptedResult2 = await noteDecryptor.decryptNotes(
                outputNote2,
                this.accountPrivateKey
              );
              if (decryptedResult2) {
                valueNoteJSON2 = decryptedResult2.valueNoteJSON;
                if (!decryptedResult2.isSender) {
                  const outputNote2Nullifier = calculateNoteNullifier(
                    Field(outputNote2.noteCommitment),
                    this.accountPrivateKey,
                    Bool(true)
                  );
                  await this.db.addNote(
                    Note.from({
                      valueNoteJSON: decryptedResult2.valueNoteJSON,
                      commitment: outputNote2.noteCommitment,
                      nullifier: outputNote2Nullifier.toString(),
                      nullified: false,
                      index: Number(tx.outputNoteCommitmentIdx2),
                    })
                  );
                }
              }
            }

            let privateValueTotal = BigInt(valueNoteJSON1!.value);
            if (valueNoteJSON2) {
              privateValueTotal += BigInt(valueNoteJSON2.value);
            }

            await this.db.upsertUserPaymentTx(
              UserPaymentTx.from({
                txHash: tx.txHash,
                accountPk: accountPk,
                actionType: tx.actionType,
                publicValue: tx.publicValue,
                publicAssetId: tx.publicAssetId,
                publicOwner: tx.publicOwner,
                txFee: tx.txFee,
                txFeeAssetId: tx.txFeeAssetId,
                depositRoot: tx.depositRoot!,
                depositIndex: Number(tx.depositIndex!),
                privateValue: privateValueTotal.toString(),
                privateValueAssetId: valueNoteJSON1!.assetId,
                sender: isSenderForTx ? accountPk : valueNoteJSON1!.creatorPk,
                receiver: isSenderForTx ? valueNoteJSON1!.ownerPk : accountPk,
                isSender: isSenderForTx,
                createdTs: block.createdTs,
                finalizedTs: block.finalizedTs,
              })
            );
          }
        }

        await this.db.nullifyNote(tx.nullifier1);
        await this.db.nullifyNote(tx.nullifier2);
      }

      this.syncedToBlock = block.blockHeight;

      await this.db.upsertUserState(
        new UserState(accountPk, this.syncedToBlock)
      );
    }
  }
}
