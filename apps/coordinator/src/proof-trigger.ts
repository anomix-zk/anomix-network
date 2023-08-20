
import { $axiosDeposit, $axiosSeq } from "./lib/api";
import { getConnection, In } from 'typeorm';
import { Block, L2Tx } from '@anomix/dao';
import { ActionType } from '@anomix/circuits';
import { BaseResponse, BlockStatus, RollupTaskDto, RollupTaskType } from '@anomix/types';

setInterval(proofTrigger, 5 * 60 * 1000); // exec/5mins

async function proofTrigger() {
    try {
        // if any one of L2Block that are about to rolling up contains depositL2Tx, then deposit_Rollup flow must keep stopping!
        let couldRestartDepositRollup = true;

        const connection = getConnection();
        const blockRepo = connection.getRepository(Block);
        await blockRepo.find({ where: { status: In([BlockStatus.PENDING, BlockStatus.PROVED]) }, order: { id: 'ASC' } }).then(blockList => {
            blockList!.forEach(async (block, indx) => {

                if (indx == 0 && block!.status == BlockStatus.PROVED) {// the lowest one with PROVED status, must align with the onchain state inside AnomixRollupContract.
                    const rollupTaskDto = {
                        taskType: RollupTaskType.ROLLUP_CONTRACT_CALL,
                        index: undefined,
                        payload: block.id
                    } as RollupTaskDto<any, any>;

                    if (block.depositCount != '0') {//ie. has depositL2Tx
                        couldRestartDepositRollup = false;
                    }

                    await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', rollupTaskDto).then(r => {
                        if (r.data.code == 1) {
                            console.error(r.data.msg);
                            throw new Error(r.data.msg);
                        }
                    }); // TODO future: could improve when fail by 'timeout' after retry

                    return;

                } else if (block.status == BlockStatus.PENDING) {
                    const l2TxRepo = connection.getRepository(L2Tx);
                    await l2TxRepo.find({ where: { blockId: block.id } }).then(txList => {
                        return txList!.some(tx => {
                            return tx.actionType == ActionType.DEPOSIT.toString();
                        });
                    }).then(async (rs) => {

                        let url: any = undefined;
                        let taskType: any = undefined;

                        if (rs) {
                            url = '/rollup/joint-split-deposit';
                            taskType = RollupTaskType.DEPOSIT_PROCESS;
                        } else {
                            // notify rollup_processor to start rollup-proof-gen
                            url = '/rollup/proof-trigger';
                            taskType = RollupTaskType.ROLLUP_PROCESS;
                        }

                        const rollupTaskDto = {
                            taskType,
                            index: undefined,
                            payload: block.id
                        } as RollupTaskDto<any, any>;

                        await $axiosSeq.post<BaseResponse<string>>(url, rollupTaskDto).then(r => {
                            if (r.data.code == 1) {
                                console.error(r.data.msg);
                                throw new Error(r.data.msg);
                            }
                        });
                    });
                }
            });
        });

        // if there is no depositTx inside the blockList above, then restart deposit_rollup flow!!
        if (couldRestartDepositRollup) {
            // (re)start deposit_rollup flow
            await $axiosDeposit.get<BaseResponse<string>>('/rollup/batch');
        }

    } catch (error) {
        console.error(error);
    }
}
