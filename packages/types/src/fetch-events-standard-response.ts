import { AccountUpdate, Field, Struct, PublicKey, UInt64, UInt32, Reducer, fetchAccount } from 'o1js';

export interface TargetTransactionInfo {
    transactionHash: string;
    transactionStatus: string;
    transactionMemo: string;
}

export interface EventTarget {
    data: any;
    transactionInfo: TargetTransactionInfo;
}

export interface EventsStandardResponse {
    blockHeight: UInt32;
    blockHash: string;
    parentBlockHash: string;
    globalSlot: UInt32;
    chainStatus: string;
    event: EventTarget;
    type: string;
}
