
export enum FlowTaskType {
    SEQUENCE = 0,
    ROLLUP_TX_BATCH_MERGE,
    BLOCK_PROVE,
    ROLLUP_CONTRACT_CALL
}

export type FLowTask<T> = {
    flowId: string,
    taskType: FlowTaskType,
    data: T
}
