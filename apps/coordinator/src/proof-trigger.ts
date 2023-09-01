import { $axiosDeposit, $axiosSeq } from "./lib/api";
import { getConnection, In, QueryRunner } from 'typeorm';
import { Block, DepositTreeTrans, SeqStatus } from '@anomix/dao';
import { BaseResponse, BlockStatus, DepositTreeTransStatus, RollupTaskDto, RollupTaskType, SequencerStatus } from '@anomix/types';
import { getLogger } from "./lib/logUtils";
import { initORM } from "./lib/orm";
import { parentPort } from "worker_threads";

process.send ?? ({// when it's a primary process, process.send == undefined. 
    type: 'status',
    data: 'online'
});
parentPort?.postMessage({// when it's not a subThread, parentPort == null. 
    type: 'status',
    data: 'online'
});

const logger = getLogger('proof-trigger');
logger.info('hi, I am proof-trigger!');

await initORM();

process.send ?? ({// if it's a subProcess
    type: 'status',
    data: 'isReady'
});
parentPort?.postMessage({// if it's a subThread
    type: 'status',
    data: 'isReady'
});

logger.info('proof-trigger is ready!');

const periodRange = 5 * 60 * 1000

await proofTrigger();
setInterval(proofTrigger, periodRange); // exec/5mins

/**
 * each time seq-rollup-proof start: if there are blocks containing depositL2Tx, {Need stop Broadcasting DepositRollupProof as L1Tx}, else {select the lowest-id depositTreeTrans with PROVED status, and broadcast its proof}
 * * this is the uniform point to decide if could Broadcasting DepositRollupProof as L1Tx
 */
async function proofTrigger() {
    const connection = getConnection();
    const queryRunner = connection.createQueryRunner();
    await queryRunner.startTransaction();
    try {

        const blockList = await queryRunner.manager.find(Block,
            {
                where: { status: In([BlockStatus.PENDING, BlockStatus.PROVED]) },
                order: { id: 'ASC' }
            });// blockList might contains blocks at previous trigger-round.

        // if any one of L2Block that are about to rolling up contains depositL2Tx, then must stop Broadcasting DepositRollupProof as L1Tx !!
        const couldTriggerDepositContact = !(blockList!.some(block => {
            // blockList might contains blocks at previous trigger-round,
            // which means that if blocks at previous trigger-round has not yet complete, then need stop Broadcasting DepositRollupProof as L1Tx,
            // further means only all existing blocks containing DepositL2Tx has confirmed at Layer1, then deposit-processor could broadcast DepositRollupProof as L1Tx

            return block.depositCount != 0//ie. has depositL2Tx within this trigger-round
        }))

        if (couldTriggerDepositContact) {// if there is no depositTx inside the blockList above, then could Broadcast DepositRollupProof as L1Tx !!
            // update db status to SeqStatus.NotAtRollup
            await setSeqProofStatus(queryRunner, SequencerStatus.NotAtRollup);

            // obtain the first DepositTreeTrans and trigger deposit-contract-call
            const dTran = await queryRunner.manager.findOne(DepositTreeTrans, {// one is enough among the period range(5mins).
                where: {
                    status: In([DepositTreeTransStatus.PROVED])
                },
                order: { id: 'ASC' },
            });

            if (!dTran) {
                return;
            }

            // dTran MUST align with the AnomixEntryContract's states.
            // assert
            // assert
            //
            //

            await $axiosDeposit.post<BaseResponse<string>>(`/rollup/contract-call/${dTran.id}`).then(r => {
                if (r.data.code == 1) {
                    throw new Error(r.data.msg);
                }
            });// TODO future: could improve when fail by 'timeout' after retry

        } else {//ie. has depositL2Tx
            // update db status to SeqStatus.ATROLLUP
            await setSeqProofStatus(queryRunner, SequencerStatus.AtRollup);
        }

        blockList!.forEach(async (block, indx) => {
            if (indx == 0 && block!.status == BlockStatus.PROVED) {// the lowest one with PROVED status, must align with the onchain state inside AnomixRollupContract.
                const rollupTaskDto = {
                    taskType: RollupTaskType.ROLLUP_CONTRACT_CALL,
                    index: undefined,
                    payload: block.id
                } as RollupTaskDto<any, any>;

                await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', rollupTaskDto).then(r => {
                    if (r.data.code == 1) {
                        logger.error(r.data.msg);
                        throw new Error(r.data.msg);
                    }
                }); // TODO future: could improve when fail by 'timeout' after retry

                return;

            } else if (block.status == BlockStatus.PENDING) {
                // to avoid double computation, should exclude those blocks that triggered previously but not completed
                const timeRange = new Date().getTime() - block.createdAt.getTime();
                if (periodRange < timeRange && timeRange < periodRange * 3) {// TODO could improve: might mistake evaluate few blocks, but no worries, they will be processed at next triggger-round!
                    return;
                }

                // ======== to here, means this block was created after last triggger-round or its proving journey was interrupted unexpectedly. ========
                let url: any = undefined;
                let taskType: any = undefined;

                if (block.depositCount != 0) {
                    url = '/rollup/joint-split-deposit';
                    taskType = RollupTaskType.DEPOSIT_JOINSPLIT;

                    const rollupTaskDto = {
                        taskType,
                        index: undefined,
                        payload: block.id
                    } as RollupTaskDto<any, any>;

                    await $axiosDeposit.post<BaseResponse<string>>(url, rollupTaskDto).then(r => {
                        if (r.data.code == 1) {
                            logger.error(r.data.msg);
                            throw new Error(r.data.msg);
                        }
                    });
                } else {
                    // notify rollup_processor to start rollup-proof-gen
                    url = '/rollup/proof-trigger';
                    taskType = RollupTaskType.ROLLUP_PROCESS;

                    const rollupTaskDto = {
                        taskType,
                        index: undefined,
                        payload: block.id
                    } as RollupTaskDto<any, any>;

                    await $axiosSeq.post<BaseResponse<string>>(url, rollupTaskDto).then(r => {
                        if (r.data.code == 1) {
                            logger.error(r.data.msg);
                            throw new Error(r.data.msg);
                        }
                    });
                }
            }
        });

    } catch (error) {
        logger.error(error);
        console.error(error);

        await queryRunner.rollbackTransaction();

    } finally {
        await queryRunner.release();
    }
}

async function setSeqProofStatus(queryRunner: QueryRunner, s: SequencerStatus) {
    const seqStatus = (await queryRunner.manager.findOne(SeqStatus, { where: { id: 1 } }))!;
    if (seqStatus.status != s) {
        seqStatus.status = s;
        await queryRunner.manager.save(seqStatus);
    }
}
