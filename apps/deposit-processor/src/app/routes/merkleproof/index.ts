import { FastifyPlugin } from "fastify"
import { queryMerkleTreeInfo } from "./query-merkle-tree-info";
import { queryMerkleWitness } from "./query-merkle-witness";
import { syncLazyDepositTree } from "./sync-lazy-deposit-tree";

export const merkleProofEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryMerkleTreeInfo);
    instance.register(syncLazyDepositTree);
    instance.register(queryMerkleWitness);
}
