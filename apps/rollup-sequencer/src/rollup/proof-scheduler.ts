
import { WorldStateDB, RollupDB, IndexDB } from "@/worldstate";
import config from "@/lib/config";
import { BaseResponse, BlockStatus, RollupTaskDto, RollupTaskType, ProofTaskDto, ProofTaskType, FlowTaskType } from "@anomix/types";
import { ActionType, AnomixRollupContract, InnerRollupProof } from "@anomix/circuits";
import { BlockProverOutput, Block, InnerRollupBatch, Task, TaskStatus, TaskType, L2Tx } from "@anomix/dao";
import { Mina, PrivateKey, PublicKey, Field } from 'snarkyjs';
import { $axiosProofGenerator, $axiosDepositProcessor, $axiosCoordinator } from "@/lib";
import { getConnection } from "typeorm";
import { syncAcctInfo } from "@anomix/utils";
import { getLogger } from "@/lib/logUtils";
const logger = getLogger('ProofScheduler');

export class ProofScheduler {

    constructor(private worldStateDB?: WorldStateDB, private rollupDB?: RollupDB, private indexDB?: IndexDB) { }

    async startBatchMerge(blockId: number) {
        const connection = getConnection();

        const txList = await connection.getRepository(L2Tx)
            .find({ where: { blockId } });
        const hasDeposit = txList!.some(tx => {
            return tx.actionType == ActionType.DEPOSIT.toString();
        });

        let latestDepositTreeRoot: string = undefined as any as string;
        if (hasDeposit) {
            //  coordinator has already stopped Broadcasting DepositRollupProof as L1Tx.
            await $axiosDepositProcessor.post<BaseResponse<string>>('/rollup/deposit-tree-root').then(r => {
                if (r.data.code == 1) {
                    throw new Error(`could not obtain latest DEPOSIT_TREE root: ${r.data.msg}`);
                }
                latestDepositTreeRoot = r.data.data!;
            });
        }

        // query related InnerRollupBatch regarding 'blockId'
        const innerRollupBatchRepo = connection.getRepository(InnerRollupBatch);
        const innerRollupBatch = await innerRollupBatchRepo.findOne({ where: { blockId } });
        if (!innerRollupBatch) {
            throw new Error(`cannot find innerRollupBatch by blockId:${blockId}`);
        }
        const innerRollupBatchParamList = JSON.parse(innerRollupBatch.inputParam);

        if (hasDeposit) {// ie. has depositL2tx, then need change to latestDepositTreeRoot
            const map = new Map<number, string>();
            txList.forEach(tx => {
                map.set(tx.id, tx.proof);
            });

            // change to latest deposit tree root
            innerRollupBatchParamList.forEach(param => {
                const paramJson = JSON.parse(param) as { txId1: number, txId2: number, innerRollupInput: string, joinSplitProof1: string, joinSplitProof2: string };

                const innerRollupInput = JSON.parse(paramJson.innerRollupInput);
                innerRollupInput.depositRoot = latestDepositTreeRoot;
                paramJson.innerRollupInput = JSON.stringify(innerRollupInput);

                // sync proof into paramJson
                paramJson.joinSplitProof1 = map.get(paramJson.txId1)!;
                paramJson.joinSplitProof2 = map.get(paramJson.txId2)!;
            })

            innerRollupBatch.inputParam = JSON.stringify(innerRollupBatchParamList);
            innerRollupBatchRepo.save(innerRollupBatch);
        }

        // send to proof-generator, construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: { blockId },
            payload: {
                flowId: undefined,
                taskType: FlowTaskType.ROLLUP_TX_BATCH_MERGE,
                data: innerRollupBatchParamList
            }
        }

        // send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*) && merge(*)'
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry
    }

    /**
     * when a MergedResult(ie. InnerRollupProof) comes back, then create L2Block.
     * @param innerRollupProofList 
     */
    async whenMergedResultComeBack(innerRollupProof: any) {
        // verify proof??
        //

        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: {},
            payload: {
                flowId: undefined,
                taskType: FlowTaskType.BLOCK_PROVE,
                data: innerRollupProof
            }
        }
        // send to proof-generator to exec BlockProver
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry
    }

    /**
     * update all related status and send to trigger ROLLUP_CONTRACT
     * @param block 
     */
    async whenL2BlockComeback(data: { blockId: number, blockProvedResult: any }) {
        // verify proof??
        //

        const { blockId, blockProvedResult } = data;

        // update all related status : BlockStatus.Proved, 
        // save it into db 
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();

        const blockRepo = connection.getRepository(Block);
        const block = (await blockRepo.findOne({ where: { id: blockId } }))!;
        try {

            block.status = BlockStatus.PROVED;
            blockRepo.save(block);

            const blockProverOutputRepo = connection.getRepository(BlockProverOutput);
            const blockProverOutput = new BlockProverOutput();
            blockProverOutput.blockId = blockId;
            blockProverOutput.output = JSON.stringify(blockProvedResult);
            blockProverOutputRepo.save(blockProverOutput);

            await queryRunner.commitTransaction();

        } catch (error) {
            logger.error(error);
            await queryRunner.rollbackTransaction();

        } finally {
            await queryRunner.release();
        }

        // check if align with AnomixRollupContract's onchain states, then it must be the lowese PENDING L2Block.
        const rollupContractAddr = PublicKey.fromBase58(config.rollupContractAddress);
        await syncAcctInfo(rollupContractAddr);
        const rollupContract = new AnomixRollupContract(rollupContractAddr);
        if (block?.dataTreeRoot0 == rollupContract.state.get().dataRoot.toString()) { // check here
            this.callRollupContract(blockId, blockProvedResult);
        }

        /*
        // notify Coordinator
        const rollupTaskDto = {} as RollupTaskDto<any, any>;
        rollupTaskDto.taskType = RollupTaskType.ROLLUP_PROCESS;
        rollupTaskDto.payload = { blockId }

        $axiosCoordinator.post<BaseResponse<any>>('/rollup/proof-notify', rollupTaskDto).then(async r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            } else if (r.data.data?.taskType == RollupTaskType.ROLLUP_CONTRACT_CALL) {
                //  if this block aligns with AnomixRollupContract's onchain states, coordinator would further command triggerring 'callRollupContract'
                await this.callRollupContract(blockId);
            }
        });// TODO future: could improve when fail by 'timeout' after retry
        */
    }

    async callRollupContract(blockId: number, blockProvedResultStr?: any) {
        // load BlockProvedResult regarding 'blockId' from db
        const connection = getConnection();
        const blockProverOutputRepo = connection.getRepository(BlockProverOutput);

        if (!blockProvedResultStr) {
            const blockProvedResult = (await blockProverOutputRepo.findOne({ where: { blockId } }))!;
            blockProvedResultStr = blockProvedResult.output;
        }

        // send to proof-generator for 'AnomixRollupContract.updateRollupState'
        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: {},
            payload: {
                flowId: undefined,
                taskType: FlowTaskType.ROLLUP_CONTRACT_CALL,
                data: blockProvedResultStr
            }
        }
        // send to proof-generator to trigger ROLLUP_CONTRACT
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });// TODO future: could improve when fail by 'timeout' after retry
    }

    async whenL1TxComeback(data: { blockId: number, tx: any }) {
        // sign and broadcast it.
        const l1Tx = Mina.Transaction.fromJSON(data.tx);
        await l1Tx.sign([PrivateKey.fromBase58(config.sequencerPrivateKey)]).send().then(async txHash => {// TODO what if it fails currently!
            const txHash0 = txHash.hash()!;

            // insert L1 tx into db, underlying 
            const connection = getConnection();
            const queryRunner = connection.createQueryRunner();
            await queryRunner.startTransaction();
            try {
                const blockRepo = connection.getRepository(Block);
                blockRepo.update({ id: data.blockId }, { l1TxHash: txHash0 });

                // save task for 'Tracer-Watcher' and also save to task for 'Tracer-Watcher'
                const taskRepo = connection.getRepository(Task);
                const task = new Task();
                task.status = TaskStatus.PENDING;
                task.taskType = TaskType.ROLLUP;
                task.txHash = txHash0;
                taskRepo.save(task);

                await queryRunner.commitTransaction();
            } catch (error) {
                logger.error(error);
                await queryRunner.rollbackTransaction();
            } finally {
                await queryRunner.release();
            }

        }).catch(reason => {
            // TODO log it
            logger.info(data.tx, ' failed!', 'reason: ', JSON.stringify(reason));
        });
    }

}
