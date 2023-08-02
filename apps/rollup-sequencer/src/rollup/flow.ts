import { WorldStateDB } from "@/worldstate/worldstate-db";
import { FlowScheduler } from "./flow-scheduler";
import { RollupDB } from "./rollup-db";
import { randomUUID } from "crypto";
import { getLogger } from "@anomix/utils";

export class RollupFlow {
    flowId: string

    flowScheduler: FlowScheduler;

    constructor(rollupDB: RollupDB, worldStateDB: WorldStateDB) {
        this.flowId = randomUUID();

        const logger = getLogger('RollupFlow');
        logger.info('start a new rollup flow:');

        // TODO prepare all for flow-scheduler


    }

}
