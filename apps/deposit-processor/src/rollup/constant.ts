
export enum FlowTaskType {
    DEPOSIT_JOIN_SPLIT,
    ROLLUP_TX_MERGE,
    ROLLUP_MERGE,
    BLOCK_PROVE,
    ROLLUP_CONTRACT_CALL
}

export type FLowTask<T> = {
    flowId: string,
    taskType: FlowTaskType,
    data: T
}
