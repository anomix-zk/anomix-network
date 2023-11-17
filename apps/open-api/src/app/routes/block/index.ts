import { FastifyPlugin } from "fastify"
import { queryAssetsInBlocks } from "./query-assets-in-block";
import { queryLatestBlockHeight } from "./query-latest-block-height";
import { recieveTx } from "../tx/recieve-tx";
import { queryByTxHashes } from "../tx/query-by-tx-hashes";
import { queryTxByNoteHash } from "../tx/query-tx-by-note-hashes";
import { queryWithdrawalNotes } from "../tx/query-withdrawal-notes";
import { queryPendingTxs } from "../tx/query-pending-txs";
import { queryPartialByBlockHeight } from "./query-block-partial-by-blockheight";

export const blockEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryAssetsInBlocks);
    instance.register(queryLatestBlockHeight);
    instance.register(queryPartialByBlockHeight);
}
