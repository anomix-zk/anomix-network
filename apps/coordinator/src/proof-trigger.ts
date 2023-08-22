import { $axiosDeposit, $axiosSeq } from "./lib/api";
import { getConnection, In } from 'typeorm';
import { Block, DepositProverOutput, DepositTreeTrans, L2Tx, SeqStatus } from '@anomix/dao';
import { ActionType } from '@anomix/circuits';
import { BaseResponse, BlockStatus, DepositTreeTransStatus, FlowTask, FlowTaskType, ProofTaskDto, ProofTaskType, RollupTaskDto, RollupTaskType, SequencerStatus } from '@anomix/types';

const periodRange = 5 * 60 * 1000

setInterval(proofTrigger, periodRange); // exec/5mins

/**
 * each time seq-rollup-proof start: if there are blocks containing depositL2Tx, {Need stop Broadcasting DepositRollupProof as L1Tx}, else {select the lowest-id depositTreeTrans with PROVED status, and broadcast its proof}
 * * this is the uniform point to decide if could Broadcasting DepositRollupProof as L1Tx
 */
async function proofTrigger() {
    try {
        const connection = getConnection();
        const blockRepo = connection.getRepository(Block);
        const blockList = await blockRepo.find(
            {
                where: { status: In([BlockStatus.PENDING, BlockStatus.PROVED]) },
                order: { id: 'ASC' }
            });// blockList might contains blocks at previous trigger-round.

        // if any one of L2Block that are about to rolling up contains depositL2Tx, then must stop Broadcasting DepositRollupProof as L1Tx !!
        const couldTriggerDepositContact = !(blockList!.some(block => {
            // blockList might contains blocks at previous trigger-round,
            // which means that if blocks at previous trigger-round has not yet complete, then need stop Broadcasting DepositRollupProof as L1Tx,
            // further means only all existing blocks containing DepositL2Tx has confirmed at Layer1, then deposit-processor could broadcast DepositRollupProof as L1Tx

            return block.depositCount != '0'//ie. has depositL2Tx within this trigger-round
        }))

        if (couldTriggerDepositContact) {// if there is no depositTx inside the blockList above, then could Broadcast DepositRollupProof as L1Tx !!
            // update db status to SeqStatus.NotAtRollup
            await setSeqProofStatus(SequencerStatus.NotAtRollup);

            // obtain the first DepositTreeTrans and trigger deposit-contract-call
            const connection = getConnection();
            const transRepo = connection.getRepository(DepositTreeTrans);
            const dTran = await transRepo.findOne({// one is enough among the period range(5mins).
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
            await setSeqProofStatus(SequencerStatus.AtRollup);
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
                        console.error(r.data.msg);
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

                if (block.depositCount != '0') {
                    url = '/rollup/joint-split-deposit';
                    taskType = RollupTaskType.DEPOSIT_JOINSPLIT;

                    const rollupTaskDto = {
                        taskType,
                        index: undefined,
                        payload: block.id
                    } as RollupTaskDto<any, any>;

                    await $axiosDeposit.post<BaseResponse<string>>(url, rollupTaskDto).then(r => {
                        if (r.data.code == 1) {
                            console.error(r.data.msg);
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
                            console.error(r.data.msg);
                            throw new Error(r.data.msg);
                        }
                    });
                }
            }
        });

    } catch (error) {
        console.error(error);
    }
}

async function setSeqProofStatus(s: SequencerStatus) {
    const connection = getConnection();
    const seqStatusReposity = connection.getRepository(SeqStatus);
    const seqStatus = (await seqStatusReposity.findOne({ where: { id: 1 } }))!;
    seqStatus.status = s;

    seqStatusReposity.save(seqStatus);
}
