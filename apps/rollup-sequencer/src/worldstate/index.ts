// initialize tree with fixed empty commitment from Value_Note.

import { SequenceFlow } from "@/rollup";
import { WorldStateDB } from "./worldstate-db";
import { IndexDB } from "./index-db";
import { RollupDB } from "./rollup-db";
import { MerkleTreeId } from "@anomix/types";

export * from './index-db'
export * from './rollup-db'
export * from './worldstate-db'

export class WorldState {
    private seqFlow: SequenceFlow

    constructor(public worldStateDB: WorldStateDB, public rollupDB: RollupDB, public indexDB: IndexDB) {


    }

    /**
     * start a new Flow
     */
    async startNewFlow() {
        this.seqFlow = new SequenceFlow(this, this.worldStateDB, this.rollupDB, this.indexDB);
        await this.seqFlow.start();
    }

    /**
     * reset
     */
    async reset() {
        await this.seqFlow?.end();

        this.seqFlow = undefined as any as SequenceFlow;
    }

    get ongingFlow() {
        return this.seqFlow;
    }
}
