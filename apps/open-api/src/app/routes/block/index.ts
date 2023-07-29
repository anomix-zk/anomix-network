import { FastifyPlugin } from "fastify"
import { queryAssetsInBlocks } from "./query-assets-in-block";

export const blockEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryAssetsInBlocks);
}
