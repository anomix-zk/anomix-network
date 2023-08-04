
import { FastifyPlugin } from "fastify"
import { triggerRollupBatch } from "./trigger-rollup-batch";

export const txEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(triggerRollupBatch);
}
