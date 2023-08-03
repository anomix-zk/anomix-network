import { initORM } from '@/lib/orm'
import { L2Tx, MemPlL2Tx, } from "@anomix/dao";
import { L2TxStatus } from "@anomix/types";
import { JoinSplitOutput } from "@anomix/circuits";
import { getConnection } from 'typeorm';
import { Field } from "snarkyjs";

export class RollupDB {
    preConfirmTxList(txList: JoinSplitOutput[]) {
        throw new Error("Method not implemented.");
    }

    async start() {
        await initORM();
    }

    /**
     * retry for new tx.
     */
    async queryPendingTxList() {
        const mpL2TxRepository = getConnection().getRepository(MemPlL2Tx);
        try {
            // TODO need retry for x times if empty result, then throw error.
            const mpTxList = await mpL2TxRepository.find({
                where: { status: L2TxStatus.PENDING },
                order: { createdAt: 'ASC' },
                // TODO add more
                // consider Account/Deposit, txFee
            }).then(txs => {
                return txs.map(tx => {
                    return tx.toCircuitType();
                });
            });

            //==============================need the check==============================
            // TODO need obtain a Distributed Lock here to notify sequencer not to start rollup before deleting the ones with less txfee in memory pool
            // 
            // 
            /*
            const [maxFeeMpL2Tx, ...sortList] = mergeList.sort((a, b) => {
                return new Field(a.txFee).greaterThan(new Field(b.txFee)).toBoolean() ? 1 : -1;
            });
    
            if (maxFeeMpL2Tx.txHash != joinSplitProof.publicOutput.hash().toString()) {
                return { code: 1, data: 'already a higher-txfee one in memory pool', msg: '' }
            }
    
            // delete the ones with less txfee in memory pool
            memPlL2TxRepository.delete(sortList.map(x => {
                return x.id
            }));
            */
            //==============================need the check==============================
            return mpTxList;

        } catch (err) {
            throw new Error('db query error!');
        }
    }

    async queryTxList() {
        //
    }

    async queryBlockByDataTreeRoot(dataTreeRoot: Field) {
        // TODO
        return { blockHeight: 1n }
    }
}
