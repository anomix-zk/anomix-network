import { FastifyPlugin } from "fastify"
import { queryAssetsInBlocks } from "./query-assets-in-block";
import { queryLatestBlockHeight } from "./query-latest-block-height";
import { recieveTx } from "./recieve-tx";

export const blockEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(recieveTx);
    instance.register(queryAssetsInBlocks);
    instance.register(queryLatestBlockHeight);
}
