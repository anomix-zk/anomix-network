import { FastifyPlugin } from "fastify"
import { queryMerkleTreeInfo } from "./query-merkle-tree-info";
import { queryMerkleProof } from "./query-merkle-proof";
import { queryWitnessByWithdrawNotes } from "./query-witness-by-withdraw-notes";
import { syncLazyDataTreeByBlockId } from "./sync-lazy-data-tree-by-blockId";
import { queryUserTreeInfo } from "./query-user-tree-info";
import { appendUserNullifierTreeByHand } from "./append-user-tree-leaves";
import { appendTreeByHand } from "./append-tree-leaves";
import { syncLazyDataTree } from "./sync-lazy-data-tree";
//import { queryWorldStateworldState } from './query-worldstate-state'
//import { checkCommitmentsExist } from './check-commiments-exist';
//import { checkNullifiersExist } from './check-nullifiers-exist';
// import { rollupSeqTrigger } from "./rollup-seq-trigger";

export const merkleProofEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryMerkleTreeInfo);
    instance.register(queryMerkleProof);
    instance.register(queryWitnessByWithdrawNotes);
    instance.register(syncLazyDataTree);
    instance.register(syncLazyDataTreeByBlockId);
    instance.register(queryUserTreeInfo);
    instance.register(appendUserNullifierTreeByHand);
    instance.register(appendTreeByHand);

    //instance.register(rollupSeqTrigger);
    // instance.register(checkCommitmentsExist);
    // instance.register(checkNullifiersExist);
    //instance.register(queryWorldStateworldState);
}
