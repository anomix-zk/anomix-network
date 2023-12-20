import { FastifyPlugin } from "fastify"
import { queryTxByNullifier } from "./query-tx-by-nullifier";
import { withdrawAsset } from "./withdraw-assets";

export const txEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryTxByNullifier);
    // instance.register(withdrawAsset);
}
