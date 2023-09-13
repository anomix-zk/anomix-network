import { FastifyPlugin } from "fastify"
import { queryMerkleTreeInfo } from "./query-merkle-tree-info";


export const merkleProofEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryMerkleTreeInfo);
}
