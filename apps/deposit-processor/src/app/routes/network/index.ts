
import { FastifyPlugin } from "fastify"
import { queryCouldStopRollup } from "./query-could-stop-rollup";

export const txEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryCouldStopRollup);
}
