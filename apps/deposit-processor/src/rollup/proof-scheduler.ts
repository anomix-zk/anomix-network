
import { WorldStateDB } from "@/worldstate/worldstate-db";
import { RollupDB } from "./rollup-db";
import config from "@/lib/config";
import { BaseResponse, DepositTreeTransStatus, ProofTaskDto, ProofTaskType } from "@anomix/types";
import { WorldState } from "@/worldstate";
import { IndexDB } from "./index-db";
import { DepositProverOutput, DepositTreeTrans } from "@anomix/dao";
import { $axiosProofGenerator } from "@/lib";
import { FlowTask, FlowTaskType } from "@anomix/types";
import { getConnection } from "typeorm";
import { Mina, PrivateKey } from 'o1js';
import { getLogger } from "@/lib/logUtils";
import fs from "fs";

const logger = getLogger('proof-scheduler');

/**
 * deposit_processor rollup proof-gen flow at 'deposit_tree'
 */
export class ProofScheduler {
    constructor(private worldState: WorldState, private worldStateDB: WorldStateDB, private rollupDB: RollupDB, private indexDB: IndexDB) { }

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
            const depositProverOutput = new DepositProverOutput();
            depositProverOutput.output = JSON.stringify(proof);
            depositProverOutput.transId = transId;
            await queryRunner.manager.save(depositProverOutput);

            // change status to Proved
            const depositTreeTransRepo = connection.getRepository(DepositTreeTrans);
            await depositTreeTransRepo.findOne({ where: { id: transId } }).then(async depositTreeTrans => {
                depositTreeTrans!.status = DepositTreeTransStatus.PROVED;
                await queryRunner.manager.save(depositTreeTrans);
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
                });

            } catch (error) {
                logger.error(error);
            }
            */
        } catch (error) {
            logger.error(error);
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
                data: {
                    transId,
                    feePayer: PrivateKey.fromBase58(config.txFeePayerPrivateKey).toPublicKey().toBase58(),
                    fee: config.l1TxFee,// 0.2 Mina as fee
                    data: JSON.parse(data)
                }
            } as FlowTask<any>
        } as ProofTaskDto<any, FlowTask<any>>;

        const fileName = './DEPOSIT_UPDATESTATE_proofTaskDto_proofReq' + new Date().getTime() + '.json';
        fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
        logger.info(`save proofTaskDto into ${fileName}`);

        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });
    }

    async whenDepositRollupL1TxComeBack(result: { transId: number, data: any }) {
        const { transId, data: tx } = result;

        // store into file for test
        const fileName = './AnomixEntryContract_DEPOSIT_UPDATESTATE_tx' + new Date().getTime() + '.json';
        fs.writeFileSync(fileName, tx);
        logger.info(`save DepositRollupL1Tx into ${fileName}`);

        // sign and broadcast it.
        const l1Tx = Mina.Transaction.fromJSON(JSON.parse(tx));
        l1Tx.transaction.feePayer.lazyAuthorization = { kind: 'lazy-signature' };
        await l1Tx.sign([PrivateKey.fromBase58(config.txFeePayerPrivateKey)]);

        /* send L1Tx fail by endpoint will not throw error */
        await l1Tx.send().then(async txHash => {// TODO what if it fails currently!
            const l1TxHash = txHash.hash()
            if (l1TxHash) {
                logger.info(`whenDepositRollupL1TxComeBack: send L1 Tx succeed! txHash:${l1TxHash}`);

                await getConnection().getRepository(DepositTreeTrans).findOne({ where: { id: transId } }).then(async dt => {
                    // insert L1 tx into db, underlying also save to task for 'Tracer-Watcher'
                    dt!.txHash = l1TxHash!;
                    await this.rollupDB.updateTreeTransAndAddWatchTask(dt!);
                });
            } else {
                logger.error('whenDepositRollupL1TxComeBack: send L1 Tx failed!');
            }
        }).catch(reason => {
            logger.error('whenDepositRollupL1TxComeBack: error occurs: ', JSON.stringify(reason));
        });
    }

}
