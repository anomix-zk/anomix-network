import { FastifyPlugin } from "fastify"
import { queryTxByNullifier } from "./query-tx-by-note-hashes";
import { withdrawAsset } from "./withdraw-assets";

export const txEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryTxByNullifier);
    // instance.register(withdrawAsset);
}
