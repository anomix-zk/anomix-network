import { SdkEventType } from "./constants";

export interface SdkEvent {
    eventType: SdkEventType;
    data?: any;
}

export interface TxInfo {
    sender: string;
    senderAlias: string | null;
    receiver: string;
    receiverAlias: string | null;
    amountOfMinaUnit: string;
    sendToken: string;
    feeOfMinaUnit: string;
    feeToken: string;
    anonToReceiver: boolean;
    isWithdraw: boolean;
}

export interface TxHis {
    txHash: string;
    actionType: string;
    publicValue: string;
    privateValue: string;
    txFee: string;
    sender: string;
    receiver: string;
    isSender: boolean;
    withdrawNoteCommitment: string | null;
    createdTs: number;
    finalizedTs: number;
}
