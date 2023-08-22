
import { WorldStateDB } from "@/worldstate/worldstate-db";
import { RollupDB } from "./rollup-db";
import config from "@/lib/config";
import { BaseResponse, DepositTreeTransStatus, ProofTaskDto, ProofTaskType, RollupTaskDto, RollupTaskType } from "@anomix/types";
import { WorldState } from "@/worldstate";
import { IndexDB } from "./index-db";
import { DepositProverOutput, DepositTreeTrans } from "@anomix/dao";
import { $axiosCoordinator, $axiosProofGenerator } from "@/lib";
import { FlowTask, FlowTaskType } from "@anomix/types";
import { getConnection } from "typeorm";
import { Mina, PrivateKey } from 'snarkyjs';
import { Field, PublicKey } from 'snarkyjs';
import { AnomixEntryContract } from "@anomix/circuits";
import { syncAcctInfo } from "@anomix/utils";


/**
 * deposit_processor rollup proof-gen flow at 'deposit_tree'
 */
export class ProofScheduler {
    constructor(private flowId: string, private worldState: WorldState, private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) { }

    /**
    * update all related status and send to trigger 'AnomixEntryContract.updateDepositState'.
    * @param result 
    */
    async whenMergedResultComeBack(result: { transId: number, data: any }) {
        const { transId, data: proof } = result;

        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();
        try {
            const depositProverOutputRepo = connection.getRepository(DepositProverOutput);
            await depositProverOutputRepo.save({
                output: proof,
                transId
            } as DepositProverOutput);

            // change status to Proved
            const depositTreeTransRepo = connection.getRepository(DepositTreeTrans);
            await depositTreeTransRepo.findOne({ where: { id: transId } }).then(depositTreeTrans => {
                depositTreeTrans!.status = DepositTreeTransStatus.PROVED;
            })
            await queryRunner.commitTransaction();

            /*
            const entryContractAddr = PublicKey.fromBase58(config.entryContractAddress);
            await syncAcctInfo(entryContractAddr);
            const entryContract = new AnomixEntryContract(entryContractAddr);
            
            // check if align with AnomixEntryContract's onchain states
            await getConnection().getRepository(DepositTreeTrans)
                .findOne({ where: { id: transId } })
                .then(async dt => {
                    if (dt!.startActionHash == entryContract.depositState.get().currentActionsHash.toString()) { // check here
                        // exec DEPOSIT_UPDATESTATE
                        this.callRollupContract(transId, proof);
                    }
                });
            */

            /* no need notify Coordinator, since Coordinator_'proof-trigger' uniformly decides if trigger DEPOSIT_CONTRACT_CALL
            try {
                // notify Coordinator
                const rollupTaskDto = {} as RollupTaskDto<any, any>;
                rollupTaskDto.taskType = RollupTaskType.DEPOSIT_BATCH_MERGE;
                rollupTaskDto.payload = { transId }

                $axiosCoordinator.post<BaseResponse<any>>('/rollup/proof-notify', rollupTaskDto).then(async r => {
                    if (r.data.code == 1) {
                        throw new Error(r.data.msg);
                    } else if (r.data.data?.taskType == RollupTaskType.DEPOSIT_CONTRACT_CALL) {
                        //  if [this depositTreeTrans aligns with AnomixEntryContract's onchain states] and [dont bother seq-rollup-proof], coordinator would further command triggerring 'callRollupContract'
                        await this.callRollupContract(transId, proof);
                    }
                });// TODO future: could improve when fail by 'timeout' after retry

            } catch (error) {
                console.error(error);
            }
            */
        } catch (error) {
            console.error(error);
            await queryRunner.rollbackTransaction();

            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async callRollupContract(transId: number, data?: any) {
        if (!data) {
            const depositProverOutputRepo = getConnection().getRepository(DepositProverOutput);
            data = (await depositProverOutputRepo.findOne({ where: { transId } }))!.output;
        }

        const proofTaskDto = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: undefined,
            payload: {
                flowId: undefined as any,
                taskType: FlowTaskType.DEPOSIT_UPDATESTATE,
                data: { transId, data }
            }
        } as ProofTaskDto<any, FlowTask<any>>;

        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });
    }

    async whenRollupL1TxComeBack(result: { transId: number, tx: any }) {
        const { transId, tx } = result;
        // sign and broadcast it.
        const l1Tx = Mina.Transaction.fromJSON(tx);
        await l1Tx.sign([PrivateKey.fromBase58(config.sequencerPrivateKey)]).send().then(async txHash => {// TODO what if it fails currently!
            await getConnection().getRepository(DepositTreeTrans).findOne({ where: { id: transId } }).then(async dt => {
                // insert L1 tx into db, underlying also save to task for 'Tracer-Watcher'
                dt!.txHash = txHash.hash()!;
                await this.rollupDB.updateTreeTransAndAddWatchTask(dt!);
            });

        }).catch(reason => {
            // TODO log it
            console.log(tx, ' failed!', 'reason: ', JSON.stringify(reason));
        });

        this.worldState.reset();
    }

}
