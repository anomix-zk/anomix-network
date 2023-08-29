import { FastifyPlugin } from "fastify"
import { queryTxByNoteHash } from "./query-tx-by-note-hashes";
import { withdrawAsset } from "./withdraw-assets";

export const txEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryTxByNoteHash);
    // instance.register(withdrawAsset);
}
