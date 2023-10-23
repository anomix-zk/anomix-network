
export interface BlockInfo {
    height: number;
    timestamp: string;
}

export interface TransactionInfo {
    hash: string;
}

export interface EventData {
    data: string[];
    transactionInfo: TransactionInfo;
}

export interface Event {
    blockInfo: BlockInfo;
    eventData: EventData[];
}

export interface Data {
    events: Event[];
}

export interface EventsHttpResponse {
    data: Data;
}
