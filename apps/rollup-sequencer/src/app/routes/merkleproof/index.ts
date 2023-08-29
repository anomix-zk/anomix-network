import { FastifyPlugin } from "fastify"
import { queryMerkleTreeInfo } from "./query-merkle-tree-info";
import { queryMerkleProof } from "./query-merkle-proof";
import { queryWitnessByWithdrawNotes } from "./query-witness-by-withdraw-notes";
import { syncLazyDataTree } from "./sync-lazy-data-tree";

export const merkleProofEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryMerkleTreeInfo);
    instance.register(queryMerkleProof);
    instance.register(queryWitnessByWithdrawNotes);
    instance.register(syncLazyDataTree);
}
