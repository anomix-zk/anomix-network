
export enum ProofTaskType {
    USER_FIRST_WITHDRAW,
    USER_WITHDRAW,
    ROLLUP_FLOW
}

export interface ProofTaskDto<S, T> {
    taskType: ProofTaskType,
    index: S
    payload: T
}
