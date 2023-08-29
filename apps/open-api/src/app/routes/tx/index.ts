import { FastifyPlugin } from "fastify"
import { queryByTxHashes } from "./query-by-tx-hashes";
import { queryTxByNoteHash } from "./query-tx-by-note-hashes";
import { queryWithdrawalNotes } from "./query-withdrawal-notes";
import { recieveTx } from "./recieve-tx";
import { withdrawAsset } from "./withdraw-assets";
import { queryPendingTxs } from "./query-pending-txs";

/**
 (5)供client查询encrypted data
    ①获取交易历史：TODO 怎么找到跟自己相关的tx?
    ②获取新收款信息

(6)供client发送L2 tx
    ① 如果是withdraw, 则返回url

(7)供client查询L2 tx的状态、数据
    ①根据TxId查询
    ②根据alias_nullifier/account_viewing_key/valueNote_commitment/nullifier查询L2Tx

(7.5) 提现场景中，提供L1Addr来查询相关的所有pending value notes
 */

export const txEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(recieveTx);
    instance.register(queryPendingTxs);
    instance.register(queryByTxHashes);
    instance.register(queryTxByNoteHash);
    instance.register(queryWithdrawalNotes);
    // instance.register(withdrawAsset);
}
