import { FastifyPlugin } from "fastify"
import { queryMerkleTreeInfo } from "./query-merkle-tree-info";
import { queryMerkleProof } from "./query-merkle-proof";
import { queryWitnessByWithdrawNotes } from "./query-witness-by-withdraw-notes";
import { syncLazyDataTree } from "./sync-lazy-data-tree";
import { queryWorldStateworldState } from './query-worldstate-state'
import { checkCommitmentsExist } from './check-commiments-exist';
import { checkNullifiersExist } from './check-nullifiers-exist';

export const merkleProofEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryMerkleTreeInfo);
    instance.register(queryMerkleProof);
    instance.register(queryWitnessByWithdrawNotes);
    instance.register(syncLazyDataTree);

    instance.register(queryWorldStateworldState);
    instance.register(checkCommitmentsExist);
    instance.register(checkNullifiersExist);
}
