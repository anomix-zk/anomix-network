import { WorldStateDB } from "@/worldstate/worldstate-db";
import { FlowScheduler } from "./flow-scheduler";
import { RollupDB } from "./rollup-db";
import { getLogger } from "@anomix/utils";


export class RollupFlow {
    private flowScheduler: FlowScheduler;

    constructor(rollupDB: RollupDB, worldStateDB: WorldStateDB) {
        const logger = getLogger('RollupFlow');
        logger.info('start a new rollup flow:');

        // TODO prepare all for flow-scheduler


    }

}
