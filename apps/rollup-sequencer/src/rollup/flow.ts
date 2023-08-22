import { WorldStateDB, RollupDB, IndexDB, WorldState } from "@/worldstate";
import { FlowScheduler } from "./flow-scheduler";
import { getConnection } from "typeorm";
import { SeqStatus } from "@anomix/dao";
import { SequencerStatus } from "@anomix/types";
//import { getLogger } from "@anomix/utils";

export class SequenceFlow {
    flowScheduler: FlowScheduler;

    constructor(private worldState: WorldState, private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) {
        // const logger = getLogger('RollupFlow');
        // logger.info('start a new rollup flow:');

        //  prepare all for flow-scheduler
        this.flowScheduler = new FlowScheduler(this.worldState, this.worldStateDB, this.rollupDB, this.indexDB);
    }

    async start() {

        this.flowScheduler.start();
    }

    async end() {
        await this.worldStateDB.rollback();

    }

}
