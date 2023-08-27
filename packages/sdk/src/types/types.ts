import { L2TxReqDto } from '@anomix/types';
import { Note } from '../note/note';
import { UserTx } from '../user_tx/user_tx';

export interface Tx {
  provedTx: L2TxReqDto;

  txInfo: {
    actionType: string;
    originTx: UserTx;
    originOutputNotes?: Note[];
    alias?: string;
  };
}
