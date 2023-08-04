// initialize tree with fixed empty commitment from Value_Note.

import { FLowTask, FlowTaskType, IndexDB, RollupDB, RollupFlow } from "@/rollup";
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

    constructor(private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) { }

    /**
     * start a new Flow
     */
    async startNewFlow() {
        this.flow = new RollupFlow(this, this.worldStateDB, this.rollupDB, this.indexDB);
        await this.flow.start();
    }

    /**
     * reset
     */
    async reset() {
        await this.flow.end();

        this.flow = undefined as any as RollupFlow;
    }

    /**
     * handleFlowTask
     */
    async handleFlowTask(flowTask: FLowTask<any>) {
        if (flowTask.flowId != this.flow?.flowId) {// outdated task
            // rid it
            console.log('rid FlowTask', JSON.stringify(flowTask));

            return;
        }

        switch (flowTask.taskType) {
            case FlowTaskType.DEPOSIT_JOIN_SPLIT:
                await this.flow.flowScheduler.whenDepositTxListComeBack(flowTask.data);
                break;

            case FlowTaskType.ROLLUP_TX_MERGE | FlowTaskType.ROLLUP_MERGE:
                await this.flow.flowScheduler.merge(flowTask.data);
                break;

            case FlowTaskType.BLOCK_PROVE:
                await this.flow.flowScheduler.whenL2BlockComeback(flowTask.data);
                break;
            case FlowTaskType.ROLLUP_CONTRACT_CALL:
                await this.flow.flowScheduler.whenL2BlockComeback(flowTask.data);
                break;

            default: // rid it
                console.log('RID FlowTask', JSON.stringify(flowTask));
                break;
        }
    }


}
