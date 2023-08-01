import { ValueNote } from '@anomix/circuits';
import { WithdrawInfoDto } from '@anomix/types';

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
    return ValueNote.fromJSON(this.valueNoteJSON);
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
