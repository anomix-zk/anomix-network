import { initORM } from '@/lib/orm'
import { L2Tx, CircuitL2Tx, TxStatus } from "@anomix/dao";
import { getConnection } from 'typeorm';
import { Field } from "snarkyjs";

export class RollupDB {
    preConfirmTxList(txList: CircuitL2Tx[]) {
        throw new Error("Method not implemented.");
    }

    async start() {
        await initORM();
    }

    /**
     * retry for new tx.
     */
    async queryPendingTxList() {
        const txRepository = getConnection().getRepository(L2Tx);
        try {
            // TODO need retry for x times if empty result, then throw error.
            const txList = await txRepository.find({
                where: { status: TxStatus.PENDING },
                order: { createdAt: 'ASC' },
                // TODO add more
                // consider Account/Deposit, txFee
            }).then(txs => {
                return txs.map(tx => {
                    return tx.toCircuitType();
                });
            });
            return txList;

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
