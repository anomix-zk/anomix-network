
import { FastifyPlugin } from "fastify"
import { triggerRollupBatch } from "./trigger-rollup-batch";
import { queryCouldStopRollup } from "./query-could-stop-rollup";

export const txEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryCouldStopRollup);
    instance.register(triggerRollupBatch);
}
