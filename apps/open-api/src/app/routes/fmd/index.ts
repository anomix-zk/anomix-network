import { FastifyPlugin } from "fastify"
import { queryByTxFmd } from "./query-by-tx-fmd";
export const txFmdEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryByTxFmd);
}
