
export enum ProofTaskType {
    USER_FIRST_WITHDRAW,
    USER_WITHDRAW,
    ROLLUP_FLOW,
    DEPOSIT_BATCH,
    DEPOSIT_MERGE,
    DEPOSIT_UPDATESTATE
}

export interface ProofTaskDto<S, T> {
    taskType: ProofTaskType,
    index: S
    payload: T
}
