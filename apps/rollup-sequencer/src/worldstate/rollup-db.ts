import { initORM } from '@/lib/orm'
import { MemPlL2Tx, } from "@anomix/dao";
import { L2TxStatus } from "@anomix/types";
import { getConnection } from 'typeorm';

export class RollupDB {
    async start() {
        await initORM();
    }

    async queryPendingTxList(take?: number) {
        const mpL2TxRepository = getConnection().getRepository(MemPlL2Tx);
        try {
            const mpTxList = await mpL2TxRepository.find({
                where: {
                    status: L2TxStatus.PENDING,
                },
                order: { txFee: 'DESC' },
                take
            }) ?? [];
            return mpTxList;
        } catch (err) {
            throw new Error('db query error!');
        }
    }
}
