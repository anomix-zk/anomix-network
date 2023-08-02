// initialize tree with fixed empty commitment from Value_Note.

import { FLowTask, FlowTaskType, RollupDB, RollupFlow } from "@/rollup";
import { WorldStateDB } from "./worldstate-db";

export * from './worldstate-db'

/**
 * Defines the  Merkle tree IDs.
 */
export enum MerkleTreeId {
    DEPOSIT_TREE = 0,
    DATA_TREE,
    NULLIFIER_TREE,
    DATA_TREE_ROOTS_TREE,
    USER_NULLIFIER_TREE
}

/**
 *  Defines tree information.
 */
export interface TreeInfo {
    /**
     * The tree ID.
     */
    treeId: MerkleTreeId;
    /**
     * The tree root.
     */
    root: Buffer;
    /**
     * The number of leaves in the tree.
     */
    size: bigint;

    /**
     * The depth of the tree.
     */
    depth: number;
}

export class WorldState {
    private flow: RollupFlow

    constructor(private worldStateDB: WorldStateDB, private rollupDB: RollupDB) {

    }

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
