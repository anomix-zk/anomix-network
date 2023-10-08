import { ValueNote } from '@anomix/circuits';
import { WithdrawInfoDto } from '@anomix/types';
import { Field, PublicKey, UInt64 } from 'o1js';
import { EMPTY_PUBLICKEY } from '../constants';

export interface ValueNoteJSON {
  accountRequired: string;
  assetId: string;
  creatorPk: string;
  inputNullifier: string;
  noteType: string;
  ownerPk: string;
  secret: string;
  value: string;
}

export function WithdrawInfoDtoToValueNoteJSON(
  dto: WithdrawInfoDto
): ValueNoteJSON {
  return {
    accountRequired: dto.accountRequired,
    assetId: dto.assetId,
    creatorPk: dto.creatorPk,
    inputNullifier: dto.inputNullifier,
    noteType: dto.noteType,
    ownerPk: dto.ownerPk,
    secret: dto.secret,
    value: dto.value,
  };
}

export class Note {
  constructor(
    public valueNoteJSON: ValueNoteJSON,
    public commitment: string,
    public nullifier: string,
    public nullified: boolean,
    public index?: number
  ) {}

  static from({
    valueNoteJSON,
    commitment,
    nullifier,
    nullified,
    index,
  }: {
    valueNoteJSON: ValueNoteJSON;
    commitment: string;
    nullifier: string;
    nullified: boolean;
    index?: number;
  }): Note {
    return new Note(valueNoteJSON, commitment, nullifier, nullified, index);
  }

  public get valueNote() {
    if (this.valueNoteJSON.creatorPk !== EMPTY_PUBLICKEY) {
      return ValueNote.fromJSON(this.valueNoteJSON) as ValueNote;
    } else {
      return new ValueNote({
        secret: Field(this.valueNoteJSON.secret),
        value: UInt64.from(this.valueNoteJSON.value),
        assetId: Field(this.valueNoteJSON.assetId),
        ownerPk: PublicKey.fromBase58(this.valueNoteJSON.ownerPk),
        accountRequired: Field(this.valueNoteJSON.accountRequired),
        creatorPk: PublicKey.empty(),
        noteType: Field(this.valueNoteJSON.noteType),
        inputNullifier: Field(this.valueNoteJSON.inputNullifier),
      });
    }
  }

  public get pending() {
    return this.index === undefined;
  }

  public get assetId() {
    return this.valueNoteJSON.assetId;
  }

  public get value() {
    return this.valueNoteJSON.value;
  }

  public get ownerPk() {
    return this.valueNoteJSON.ownerPk;
  }

  public get ownerAccountRequired() {
    return this.valueNoteJSON.accountRequired;
  }
}
