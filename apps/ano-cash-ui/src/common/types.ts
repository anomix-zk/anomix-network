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
}
