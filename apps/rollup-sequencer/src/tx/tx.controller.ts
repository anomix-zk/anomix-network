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
import { Controller, Get, Post, Query } from "@nestjs/common";

@Controller("tx")
export class TxController {
    constructor() {}

    /**
     * 供client发送L2 tx
     *  ① 如果是withdraw, 则返回url
     */
    @Post()
    public recieveTx() {
        return "";
    }

    /**
     * 供client根据TxId查询L2 tx的状态、数据
     */
    @Get(":id")
    public queryByTxid() {
        return "";
    }

    /**
     * 根据alias_nullifier/account_viewing_key/valueNote_commitment/nullifier查询L2Tx
     */
    @Get("notehash")
    public queryTxByNoteHashes(hashes: any) {
        return "";
    }

    /**
     * 提现场景中，提供L1Addr来查询相关的所有pending value notes
     */
    @Get("l1addr")
    public queryWithdrawalNotesByL1Addr(addr: any) {
        return "";
    }
}
