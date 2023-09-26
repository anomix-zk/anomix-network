import { FastifyPlugin } from "fastify"
import { queryAssetsInBlocks } from "./query-assets-in-block";
import { queryLatestBlockHeight } from "./query-latest-block-height";
import { recieveTx } from "./recieve-tx";
import { queryByTxHashes } from "./query-by-tx-hashes";
import { queryTxByNoteHash } from "./query-tx-by-note-hashes";
import { queryWithdrawalNotes } from "./query-withdrawal-notes";
import { queryPendingTxs } from "./query-pending-txs";
import { queryPartialByBlockHeight } from "./query-block-partial-by-blockheight";

export const blockEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(recieveTx);
    instance.register(queryPendingTxs);
    instance.register(queryByTxHashes);
    instance.register(queryTxByNoteHash);
    instance.register(queryWithdrawalNotes);

    instance.register(queryAssetsInBlocks);
    instance.register(queryLatestBlockHeight);
    instance.register(queryPartialByBlockHeight);
}
