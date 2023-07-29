import { FastifyPlugin } from "fastify"
import { queryByTxIds } from "./query-by-txids";
import { queryTxByNoteHash } from "./query-tx-by-note-hashes";
import { queryWithdrawalNotesByL1Addr } from "./query-withdrawal-notes-by-L1-addr";
import { recieveTx } from "./recieve-tx";
import { withdrawAsset } from "./withdraw-assets";

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
    instance.register(queryByTxIds);
    instance.register(queryTxByNoteHash);
    instance.register(queryWithdrawalNotesByL1Addr);
    instance.register(withdrawAsset);
}
