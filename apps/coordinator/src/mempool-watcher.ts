
import config from './lib/config';
import { getConnection } from 'typeorm';
import { Block, MemPlL2Tx } from '@anomix/dao';
import { BaseResponse, L2TxStatus, RollupTaskDto, RollupTaskType } from '@anomix/types';
import { parentPort } from 'worker_threads';
import { $axiosSeq } from './lib/api';

let highFeeTxExit = false;
let lastSeqTs = new Date().getTime();

parentPort?.on('message', async value => {
    highFeeTxExit = true;
    await mempoolWatch();
})

setInterval(mempoolWatch, 1 * 60 * 1000);// exec/1min

async function mempoolWatch() {
    try {
        const rollupTaskDto = {
            taskType: RollupTaskType.SEQUENCE,
            index: undefined,
            payload: undefined
        } as RollupTaskDto<any, any>;

        // when there exists a highFee L2Tx, then trigger seq directly
        if (highFeeTxExit) {
            // trigger seq
            await $axiosSeq.post<BaseResponse<string>>('/rollup/seq-trigger', rollupTaskDto).then(r => {
                if (r.data.code == 1) {
                    console.error(r.data.msg);
                    throw new Error(r.data.msg);
                }
            }); // TODO future: could improve when fail by 'timeout' after retry

            return;
        }

        if ((new Date().getTime() - lastSeqTs) < 1 * 60 * 1000) {// if interval event just happens sooner after highFeeTx exits
            return;
        }

        const connection = getConnection();
        const mpL2TxRepo = connection.getRepository(MemPlL2Tx);

        // 1) check maxMpTxCnt
        const mpTxList = await mpL2TxRepo.find({ where: { status: L2TxStatus.PENDING } });
        if (mpTxList.length >= config.maxMpTxCnt) {
            // trigger seq
            await $axiosSeq.post<BaseResponse<string>>('/rollup/seq-trigger', rollupTaskDto).then(r => {
                if (r.data.code == 1) {
                    console.error(r.data.msg);
                    throw new Error(r.data.msg);
                }
            }); // TODO future: could improve when fail by 'timeout' after retry

            return;
        }

        // 2) check maxMpTxFeeSUM
        const txFeeSum = mpTxList.reduce((p, c) => {
            return p + Number(c.txFee);
        }, 0);
        if (txFeeSum >= config.maxMpTxFeeSUM) {
            // trigger seq
            await $axiosSeq.post<BaseResponse<string>>('/rollup/seq-trigger', rollupTaskDto).then(r => {
                if (r.data.code == 1) {
                    console.error(r.data.msg);
                    throw new Error(r.data.msg);
                }
            }); // TODO future: could improve when fail by 'timeout' after retry

            return;
        }

        // 3) check maxBlockInterval
        const blockRepo = connection.getRepository(Block);
        await blockRepo.findOne({ order: { id: 'DESC' } }).then(async block => {
            if (new Date().getTime() - block!.createdAt.getTime() >= config.maxBlockInterval) {
                // trigger seq
                await $axiosSeq.post<BaseResponse<string>>('/rollup/seq-trigger', rollupTaskDto).then(r => {
                    if (r.data.code == 1) {
                        console.error(r.data.msg);
                        throw new Error(r.data.msg);
                    }
                }); // TODO future: could improve when fail by 'timeout' after retry

            }
        });

    } catch (error) {
        console.error(error);
    } finally {
        highFeeTxExit = false;
        lastSeqTs = new Date().getTime();
    }
}
