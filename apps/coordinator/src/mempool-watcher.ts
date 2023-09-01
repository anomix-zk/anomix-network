
import config from './lib/config';
import { getConnection } from 'typeorm';
import { Block, MemPlL2Tx } from '@anomix/dao';
import { BaseResponse, L2TxStatus, RollupTaskDto, RollupTaskType } from '@anomix/types';
import { parentPort } from 'worker_threads';
import { $axiosSeq } from './lib/api';
import { getLogger } from "./lib/logUtils";
import { initORM } from './lib/orm';


process.send ?? ({// when it's a primary process, process.send == undefined. 
    type: 'status',
    data: 'online'
});
parentPort?.postMessage({// when it's not a subThread, parentPort == null. 
    type: 'status',
    data: 'online'
});

const logger = getLogger('mempool-watcher');
logger.info('hi, I am mempool-watcher!');

await initORM();

logger.info('mempool-watcher is ready!');

let highFeeTxExit = false;
let lastSeqTs = new Date().getTime();

// if parentPort != undefined/null, then it's a subThread, else it's a process.
parentPort ?? process.on('message', async value => {
    highFeeTxExit = true;
    await mempoolWatch();
})

process.send ?? ({// if it's a subProcess
    type: 'status',
    data: 'isReady'
});
parentPort?.postMessage({// if it's a subThread
    type: 'status',
    data: 'isReady'
});

await mempoolWatch();

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
                    logger.error(r.data.msg);
                    throw new Error(r.data.msg);
                }
            }); // TODO future: could improve when fail by 'timeout' after retry

            return;
        }

        if ((new Date().getTime() - lastSeqTs) < 1 * 60 * 1000) {// if interval event just happens sooner after highFeeTx exits
            return;
        }

        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();
        try {

            // 1) check maxMpTxCnt
            const mpTxList = await queryRunner.manager.find(MemPlL2Tx, { where: { status: L2TxStatus.PENDING } });
            if (mpTxList.length >= config.maxMpTxCnt) {
                // trigger seq
                await $axiosSeq.post<BaseResponse<string>>('/rollup/seq-trigger', rollupTaskDto).then(r => {
                    if (r.data.code == 1) {
                        logger.error(r.data.msg);
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
                        logger.error(r.data.msg);
                        throw new Error(r.data.msg);
                    }
                }); // TODO future: could improve when fail by 'timeout' after retry

                return;
            }

            // 3) check maxBlockInterval
            await queryRunner.manager.findOne(Block, { order: { id: 'DESC' } }).then(async block => {
                if (!block) {
                    logger.warn('when check maxBlockInterval, fetch no blocks!');
                    return;
                }
                if (new Date().getTime() - block!.createdAt.getTime() >= config.maxBlockInterval) {
                    // trigger seq
                    await $axiosSeq.post<BaseResponse<string>>('/rollup/seq-trigger', rollupTaskDto).then(r => {
                        if (r.data.code == 1) {
                            logger.error(r.data.msg);
                            throw new Error(r.data.msg);
                        }
                    }); // TODO future: could improve when fail by 'timeout' after retry

                }
            });

            await queryRunner.commitTransaction();
        } catch (error) {
            logger.error(error);

            console.error(error);

            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }
    } catch (error) {
        logger.error(error);
    } finally {
        highFeeTxExit = false;
        lastSeqTs = new Date().getTime();
    }
}
