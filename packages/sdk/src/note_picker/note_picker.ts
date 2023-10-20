import { AccountRequired } from '@anomix/circuits';
import { Database } from '../database/database';
import { Note } from '../note/note';

export class NotePicker {
  private sortedNotes: Note[];

  constructor(notes: Note[] = []) {
    // fiter pending notes and sort by value
    this.sortedNotes = notes
      .filter((n) => !n.pending)
      .sort((a, b) => Number(BigInt(b.value) - BigInt(a.value)));
  }

  public pick(
    amount: bigint,
    assetId: string,
    accountRequired: string,
    pendingNullifiers: string[]
  ): Note[] {
    let filterNotes: Note[] = [];
    if (pendingNullifiers.length > 0) {
      filterNotes = this.sortedNotes.filter(
        (n) => pendingNullifiers.indexOf(n.nullifier) === -1
      );
    } else {
      filterNotes = this.sortedNotes;
    }

    if (accountRequired === AccountRequired.REQUIRED.toString()) {
      filterNotes = filterNotes.filter((n) => n.assetId === assetId.toString());
    } else {
      filterNotes = filterNotes.filter(
        (n) =>
          n.assetId === assetId.toString() &&
          n.ownerAccountRequired === AccountRequired.NOTREQUIRED.toString()
      );
    }

    if (filterNotes.length == 0) {
      throw new Error('No unspent note that meets the requirement');
    }
    if (filterNotes.length == 1) {
      if (BigInt(filterNotes[0].value) >= amount) {
        return [filterNotes[0]];
      }

      throw new Error('No unspent note that meets the requirement');
    } else {
      if (
        BigInt(filterNotes[0].value) + BigInt(filterNotes[1].value) >=
        amount
      ) {
        return [filterNotes[0], filterNotes[1]];
      }

      throw new Error('No unspent note that meets the requirement');
    }
  }
}
