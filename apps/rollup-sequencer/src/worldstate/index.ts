// initialize tree with fixed empty commitment from Value_Note.

import { FLowTask, FlowTaskType, RollupFlow } from "@/rollup";

export * from './worldstate-db'

export class WorldState {
    private flow: RollupFlow

    /**
     * start a new Flow
     */
    public start() {
        //
    }

    /**
     * reset
     */
    public reset() {
        // make this.flow = null
    }

    /**
     * handleFlowTask
     */
    public handleFlowTask(flowTask: FLowTask) {
        if (flowTask.flowId != this.flow?.flowId) {
            // rid it
            console.log('RID FlowTask', JSON.stringify(flowTask));

            return;
        }

        switch (flowTask.taskType) {
            case FlowTaskType.DEPOSIT_JOIN_SPLIT:
                this.flow.flowScheduler.whenDepositTxListComeBack(flowTask.data);
                break;

            case FlowTaskType.ROLLUP_TX_MERGE | FlowTaskType.ROLLUP_MERGE:
                this.flow.flowScheduler.merge(flowTask.data);
                break;

            case FlowTaskType.BLOCK_CREATE:
                this.flow.flowScheduler.whenL2BlockComeback(flowTask.data);
                break;
            case FlowTaskType.ROLLUP_CONTRACT_CALL:
                this.flow.flowScheduler.whenL2BlockComeback(flowTask.data);
                break;

            default: // rid it
                console.log('RID FlowTask', JSON.stringify(flowTask));
                break;
        }
    }


}
