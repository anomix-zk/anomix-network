import { BaseResponse, RollupTaskDto, RollupTaskType } from "@anomix/types";
import { parentPort } from "worker_threads";
import { $axiosSeq } from "@/lib/api";

export function highFeeTxExist() {
    try {
        // notify worker to seq.
        (process.send as any)({// when it's a subProcess 
            type: 'seq',
            data: ''
        });
        parentPort?.postMessage({// when it's a subThread
            type: 'seq',
            data: ''
        });
        return { code: 0, data: '', msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function proofNotify(dto: RollupTaskDto<any, any>) {
    try {
        const targetId = dto.payload.blockId as number;

        const respondData: any = undefined;

        if (dto.taskType == RollupTaskType.DEPOSIT_JOINSPLIT) {// when join-split_deposit done, coordinator trigger ROLLUP_PROCESSOR to start rolluping; 
            // trigger ROLLUP_PROCESSOR to start rolluping; 
            dto.taskType = RollupTaskType.ROLLUP_PROCESS;
            await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', dto);

        }

        /* no need this. since 'mempool-watcher.ts' will decide if trigger 'DEPOSIT_CONTRACT_CALL'

        else if (dto.taskType == RollupTaskType.DEPOSIT_BATCH_MERGE) {// when DEPOSIT_BATCH_MERGE done, then need check if bother seq-rollup-proof
            // check if bother seq-rollup-proof 
            const connection = getConnection();
            const seqStatusReposity = connection.getRepository(SeqStatus);
            const seqStatus = (await seqStatusReposity.findOne({ where: { id: 1 } }))!;
            if (seqStatus.status == SequencerStatus.NotAtRollup) {
                const entryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
                await syncAcctInfo(entryContractAddr);
                const entryContract = new AnomixEntryContract(entryContractAddr);
                // check if align with AnomixEntryContract's onchain states
                await getConnection().getRepository(DepositTreeTrans)
                    .findOne({ where: { id: targetId } })
                    .then(async dt => {
                        if (dt!.startActionHash == entryContract.depositState.get().currentActionsHash.toString()) { // check here
                            dto.taskType = RollupTaskType.DEPOSIT_CONTRACT_CALL;
                            respondData = dto;
                        }
                    });
            }
        }
        */

        /* mv to sequencer side
        else if (dto.taskType == RollupTaskType.ROLLUP_PROCESS) {// when L2Block_proved done, coordinator trigger ROLLUP_PROCESSOR to invoke AnomixRollupContract; 
            const rollupContractAddr = PublicKey.fromBase58(config.rollupContractAddress);
            await syncAcctInfo(rollupContractAddr);
            const rollupContract = new AnomixRollupContract(rollupContractAddr);
            // check if align with AnomixRollupContract's onchain states, then it must be the lowese PENDING L2Block.
            await getConnection().getRepository(Block)
                .findOne({ where: { id: targetId } })
                .then(async block => {
                    if (block?.dataTreeRoot0 == rollupContract.state.get().dataRoot.toString()) { // check here
                        dto.taskType = RollupTaskType.ROLLUP_CONTRACT_CALL;
                        respondData = dto;
                    }
                });
        }
        */

        return { code: 0, data: respondData, msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}
