export enum RollupTaskType {
    SEQUENCE = 20,
    DEPOSIT_PROCESS,
    DEPOSIT_CONTRACT_CALL,

    ROLLUP_PROCESS,
    ROLLUP_CONTRACT_CALL
}

export interface RollupTaskDto<S, T> {
    taskType: RollupTaskType,
    index: S
    payload: T
}
