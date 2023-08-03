import { WorldStateDB } from "@/worldstate/worldstate-db";
import { FlowScheduler } from "./flow-scheduler";
import { RollupDB } from "./rollup-db";
import { randomUUID } from "crypto";
import { IndexDB } from "./index-db";
import { WorldState } from "@/worldstate";
import { getConnection } from "typeorm";
import { SeqStatus } from "@anomix/dao";
import { SequencerStatus } from "@anomix/types";
//import { getLogger } from "@anomix/utils";


export class RollupFlow {
    flowId: string

    flowScheduler: FlowScheduler;

    constructor(private worldState: WorldState, private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) {
        this.flowId = randomUUID();

        // const logger = getLogger('RollupFlow');
        // logger.info('start a new rollup flow:');

        //  prepare all for flow-scheduler
        new FlowScheduler(this.flowId, this.worldState, this.worldStateDB, this.rollupDB, this.indexDB).start();

    }

    async start() {
        // update db status to SeqStatus.ATROLLUP
        const connection = getConnection();
        const seqStatusReposity = connection.getRepository(SeqStatus);
        const seqStatus = (await seqStatusReposity.findOne({ where: { id: 1 } }))!;
        seqStatus.status = SequencerStatus.AtRollup;

        seqStatusReposity.save(seqStatus);

        this.flowScheduler.start();
    }

    async end() {
        await this.worldStateDB.rollback();

        // update db status to SeqStatus.NOTATROLLUP
        const connection = getConnection();
        const seqStatusReposity = connection.getRepository(SeqStatus);

        const seqStatus = (await seqStatusReposity.findOne({ where: { id: 1 } }))!;
        seqStatus.status = SequencerStatus.NotAtRollup;
        seqStatusReposity.save(seqStatus);
    }

}
