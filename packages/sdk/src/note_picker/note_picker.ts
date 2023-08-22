import { AccountRequired } from '@anomix/circuits';
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
    accountRequired: string
  ): Note[] {
    let filterNotes: Note[] = [];
    if (accountRequired === AccountRequired.REQUIRED.toString()) {
      filterNotes = this.sortedNotes.filter(
        (n) => n.assetId === assetId.toString()
      );
    } else {
      filterNotes = this.sortedNotes.filter(
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
