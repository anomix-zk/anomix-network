import { WorldStateDB } from "@/worldstate/worldstate-db";
import { FlowScheduler } from "./flow-scheduler";
import { RollupDB } from "./rollup-db";
import { randomUUID } from "crypto";
import { IndexDB } from "./index-db";
import { WorldState } from "@/worldstate";

export class RollupFlow {
    flowId: string

    flowScheduler: FlowScheduler;

    constructor(private worldState: WorldState, private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) {
        this.flowId = randomUUID();
        //  prepare all for flow-scheduler
        new FlowScheduler(this.flowId, this.worldState, this.worldStateDB, this.rollupDB, this.indexDB).start();

    }

    async start() {
        this.flowScheduler.start();
    }

    async end() {
        await this.worldStateDB.rollback();

    }

}
