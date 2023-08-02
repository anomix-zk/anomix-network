import { initORM } from '@/lib/orm'
import { L2Tx, MemPlL2Tx, L2TxStatus } from "@anomix/dao";
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
                where: { status: TxStatus.PENDING },
                order: { createdAt: 'ASC' },
                // TODO add more
                // consider Account/Deposit, txFee
            }).then(txs => {
                return txs.map(tx => {
                    return tx.toCircuitType();
                });
            });
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
