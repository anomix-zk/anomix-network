import { initORM } from '@/lib/orm'
import { BlockProverOutputEntity, DepositCommitment, L2Tx, MemPlL2Tx, WithdrawInfo, } from "@anomix/dao";
import { L2TxStatus } from "@anomix/types";
import { JoinSplitOutput, JoinSplitProof } from "@anomix/circuits";
import { getConnection } from 'typeorm';
import { Field } from "snarkyjs";

export class RollupDB {
    async updateDepositState(depositTxList: JoinSplitProof[]) {
        // TODO DepositStatus.PROCESSING() & l2TxId & l2TxHash
        //
        //
    }

    async start() {
        await initORM();
    }

    async queryPendingTxList(take?: number) {
        const mpL2TxRepository = getConnection().getRepository(MemPlL2Tx);
        try {
            // TODO improve retry for x times if empty result, then throw error.
            const mpTxList = await mpL2TxRepository.find({
                where: {
                    status: L2TxStatus.PENDING,
                },
                order: { txFee: 'DESC' },
                take
            }) ?? [];
            if (mpTxList.length == 0) {
                return mpTxList;
            }

            // check if there are same txs containing the same nullifier1/2, then select the ones with highest txFee.
            // and make the others fail into DB_MemPlL2Tx!!
            // NOTE: this checks must be placed here and cannot be placed at '/receive/tx'.
            const map = new Map<string, MemPlL2Tx>();
            mpTxList.forEach(tx => {
                const tx1 = map.get(tx.nullifier1);
                if ((Number((tx1?.txFee) ?? '0')) < Number(tx.txFee)) {
                    map.set(tx.nullifier1, tx);
                }
                const tx2 = map.get(tx.nullifier2);
                if ((Number((tx2?.txFee) ?? '0')) < Number(tx.txFee)) {
                    map.set(tx.nullifier2, tx);
                }
            })
            // rm duplicate
            const set = new Set<MemPlL2Tx>();
            let i = 0
            let values = map.values();
            while (i < map.size) {
                set.add(values.next().value);
                i++;
            }

            // start a Mysql.transaction
            const queryRunner = mpL2TxRepository.queryRunner!;

            await queryRunner.startTransaction();

            const ridTxList: MemPlL2Tx[] = [];
            mpTxList.forEach(tx => {
                if (!set.has(tx)) {
                    tx.status = L2TxStatus.FAILED;
                    ridTxList.push(tx);
                }
            })
            mpL2TxRepository.save(ridTxList);

            await queryRunner.commitTransaction();

            return [...set];
        } catch (err) {
            throw new Error('db query error!');
        }
    }

    async queryDepositCommitmentList(depositStartIndexInBlock: Field) {

        //const DepositCommitment

        return [] as DepositCommitment[]
    }

    async commit(block: any) {
        // start TypeOrm.transaction:
        //   insert Block into DB
        //   move related all MpL2Tx to L2Tx
        //   update related L2Tx(blockId, status:L2TxStatus.CONFIRMED)

        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        queryRunner.startTransaction();

        const txRepository = connection.getRepository(L2Tx)

        const mpTxRepository = connection.getRepository(MemPlL2Tx)

        const depositCommitmentRepository = connection.getRepository(DepositCommitment); // DepositCommitment;  DepositStatus.CONFIRMED

        const blockEntities = await connection.getRepository(BlockProverOutputEntity).insert(...);// BlockStatus.PENDING

        queryRunner.commitTransaction();
    }

    async saveL1Tx(blockId: number, l1TxHash: any) {
        // insert L1 tx into db, also save to task for 'Tracer-Watcher'
        //
        //
    }
}
