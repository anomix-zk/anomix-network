
import { WorldStateDB, RollupDB, IndexDB } from "@/worldstate";
import config from "@/lib/config";
import { BaseResponse, BlockStatus, ProofTaskDto, ProofTaskType, FlowTaskType, BlockCacheType } from "@anomix/types";
import { ActionType, AnomixEntryContract, AnomixRollupContract, BlockProveInput, BlockProveOutput, DataMerkleWitness, InnerRollupProof, RollupProof, RootMerkleWitness, ValueNote } from "@anomix/circuits";
import { BlockProverOutput, Block, InnerRollupBatch, Task, TaskStatus, TaskType, L2Tx, WithdrawInfo, BlockCache } from "@anomix/dao";
import { Mina, PrivateKey, PublicKey, Field, UInt64, Signature } from 'o1js';
import { $axiosProofGenerator, $axiosDepositProcessor } from "@/lib";
import { getConnection } from "typeorm";
import { syncAcctInfo } from "@anomix/utils";
import { getLogger } from "@/lib/logUtils";
import fs from "fs";
import assert from "assert";
import { randomUUID } from "crypto";
import { getDateString } from "@/lib/timeUtils";

const logger = getLogger('ProofScheduler');

export class ProofScheduler {

    constructor(private worldStateDB?: WorldStateDB, private rollupDB?: RollupDB, private indexDB?: IndexDB) { }

    async startBatchMerge(payload: { blockId: number }) {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        await queryRunner.startTransaction();

        const blockId = payload.blockId;
        try {
            const txList = await queryRunner.manager.find(L2Tx, { where: { blockId } });
            const hasDeposit = txList!.some(tx => {
                return tx.actionType == ActionType.DEPOSIT.toString();
            });

            /* No need. 
            // if there are depositTx, then each depositTx has already obtained the latest depositTree root at seq section! and coordinator has already stopped Broadcasting DepositRollupProof as L1Tx.
            // if no depositTx, then constract circuit will not check if it's latest depositTree root.

            let latestDepositTreeRoot: string = undefined as any as string;
            if (hasDeposit) {
                //  coordinator has already stopped Broadcasting DepositRollupProof as L1Tx.
                await $axiosDepositProcessor.get<BaseResponse<string>>('/rollup/deposit-tree-root').then(r => {
                    if (r.data.code == 1) {
                        throw new Error(`could not obtain latest DEPOSIT_TREE root: ${r.data.msg}`);
                    }
                    latestDepositTreeRoot = r.data.data!;
                });
            }
            */

            // query related InnerRollupBatch regarding 'blockId'
            const innerRollupBatch = await queryRunner.manager.findOne(InnerRollupBatch, { where: { blockId } });
            if (!innerRollupBatch) {
                throw new Error(`cannot find innerRollupBatch by blockId:${blockId}`);
            }
            const innerRollupBatchParamList: {
                txId1: string,
                txId2: string,
                innerRollupInput: any,
                joinSplitProof1: any,
                joinSplitProof2: any
            }[] = JSON.parse(innerRollupBatch.inputParam);

            if (hasDeposit) {
                const map = new Map<string, string>();
                txList.forEach(tx => {
                    map.set(tx.txHash, tx.proof);
                });

                // change to latest deposit tree root
                innerRollupBatchParamList.forEach(param => {
                    /*
                    const innerRollupInput = JSON.parse(param.innerRollupInput);
                    innerRollupInput.tx1RootWitnessData = JSON.parse('{"dataRootIndex":"0","witness":{"path":["10798256833514586784794049377907159296211331399581827811000634052637031259199","21565680844461314807147611702860246336805372493508489110556896454939225549736","2447983280988565496525732146838829227220882878955914181821218085513143393976","544619463418997333856881110951498501703454628897449993518845662251180546746"]}}');
                    innerRollupInput.tx2RootWitnessData = JSON.parse('{"dataRootIndex":"0","witness":{"path":["10798256833514586784794049377907159296211331399581827811000634052637031259199","21565680844461314807147611702860246336805372493508489110556896454939225549736","2447983280988565496525732146838829227220882878955914181821218085513143393976","544619463418997333856881110951498501703454628897449993518845662251180546746"]}}');
                    param.innerRollupInput = JSON.stringify(innerRollupInput);
                    */
                    // sync proof into paramJson
                    param.joinSplitProof1 = map.get(param.txId1)!;
                    if (param.txId2) {// if dummyTx, param.txId2 == undefined, should skip!
                        param.joinSplitProof2 = map.get(param.txId2)!;
                    } else {
                        param.joinSplitProof2 = JSON.stringify(config.joinsplitProofDummyTx.toJSON());
                    }

                })

                innerRollupBatch.inputParam = JSON.stringify(innerRollupBatchParamList);
                await queryRunner.manager.save(innerRollupBatch);
            }

            // send to proof-generator, construct proofTaskDto
            const proofTaskDto: ProofTaskDto<any, any> = {
                taskType: ProofTaskType.ROLLUP_FLOW,
                index: {
                    blockId,
                    uuid: randomUUID().toString()
                },
                payload: {
                    flowId: undefined,
                    taskType: FlowTaskType.ROLLUP_TX_BATCH_MERGE,
                    data: innerRollupBatchParamList
                }
            }

            const fileName = './ROLLUP_TX_BATCH_MERGE_proofTaskDto_' + proofTaskDto.index.uuid + '_proofReq_' + getDateString() + '.json';
            fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
            logger.info(`save proofTaskDto into ${fileName}`);

            // send to proof-generator for exec 'InnerRollupProver.proveTxBatch(*) && merge(*)'
            await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
                if (r.data.code == 1) {
                    throw new Error(r.data.msg); // rollback all db.op
                }
            });

            await queryRunner.commitTransaction();

            logger.info('startBatchMerge: done');
        } catch (error) {
            logger.error(error);
            console.error(error);

            await queryRunner.rollbackTransaction();

            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * when a MergedResult(ie. InnerRollupProof) comes back, then create L2Block.
     * @param innerRollupProofList 
     */
    async whenMergedResultComeBack(blockId: number, innerRollupProof1: any) {
        const connection = getConnection();
        const block = (await connection.getRepository(Block).findOne({ where: { id: blockId } }))!;
        const txFeeCommitment = block.txFeeCommitment;
        const txFeeWInfo = (await connection.getRepository(WithdrawInfo).findOne({ where: { outputNoteCommitment: txFeeCommitment } }))!;
        const blockCacheWitnessTxFee = (await connection.getRepository(BlockCache).findOne({ where: { blockId, type: BlockCacheType.TX_FEE_EMPTY_LEAF_WITNESS } }))!;
        const blockCacheWitnessDataTreeRoot = (await connection.getRepository(BlockCache).findOne({ where: { blockId, type: BlockCacheType.DATA_TREE_ROOT_EMPTY_LEAF_WITNESS } }))!;

        const innerRollupProof = InnerRollupProof.fromJSON(innerRollupProof1);
        const depositRoot = innerRollupProof.publicOutput.depositRoot;
        const txFeeReceiverNote: ValueNote = new ValueNote({
            secret: Field(txFeeWInfo.secret),
            ownerPk: PublicKey.fromBase58(txFeeWInfo.ownerPk),
            accountRequired: Field(txFeeWInfo.accountRequired),
            creatorPk: PublicKey.empty(), // PublicKey.fromBase58(txFeeWInfo.creatorPk),
            value: UInt64.from(txFeeWInfo.value),
            assetId: Field(txFeeWInfo.assetId),
            inputNullifier: Field(txFeeWInfo.inputNullifier),
            noteType: Field(txFeeWInfo.noteType)
        });
        const dataStartIndex = Field(txFeeWInfo.outputNoteCommitmentIdx);
        const oldDataWitness: DataMerkleWitness = DataMerkleWitness.fromMerkleProofDTO(JSON.parse(blockCacheWitnessTxFee.cache));

        const oldDataRootsRoot: Field = innerRollupProof.publicOutput.dataRootsRoot;
        const rootStartIndex: Field = Field(block.dataTreeRoot1Indx);
        const oldRootWitness: RootMerkleWitness = new RootMerkleWitness(
            JSON.parse(blockCacheWitnessDataTreeRoot.cache).paths.map(p => Field(p))
        );

        // compose BlockProveInput
        const blockProveInput = new BlockProveInput({
            txFeeReceiverNote,
            oldDataWitness,
            dataStartIndex,
            rootStartIndex,
            oldRootWitness
        });

        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: {
                blockId,
                uuid: randomUUID().toString()
            },
            payload: {
                flowId: undefined,
                taskType: FlowTaskType.BLOCK_PROVE,
                data: {
                    blockProveInput,
                    innerRollupProof: innerRollupProof1
                }
            }
        }

        const fileName = './BLOCK_PROVE_proofTaskDto_' + proofTaskDto.index.uuid + '_proofReq_' + getDateString() + '.json';
        fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
        logger.info(`save proofTaskDto into ${fileName}`);

        // send to proof-generator to exec BlockProver
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });
        logger.info('whenMergedResultComeBack: done');
    }

    /**
     * update all related status and send to trigger ROLLUP_CONTRACT
     * @param block 
     */
    async whenL2BlockComeback(blockId: number, blockProvedResult: any) {
        const blockProvedResultStr: string = JSON.stringify(blockProvedResult);
        // update all related status : BlockStatus.Proved, 
        // save it into db 
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();

        let block: Block = undefined as any;
        try {
            block = (await queryRunner.manager.findOne(Block, { where: { id: blockId } }))!;
            if (block.status == BlockStatus.CONFIRMED) {
                logger.info(`duplicated proof result, due to block.status == BlockStatus.CONFIRMED.`);
                logger.info(`this process end.`);
                return;
            }

            block.status = BlockStatus.PROVED;
            await queryRunner.manager.save(block);

            const blockProverOutput = new BlockProverOutput();
            blockProverOutput.blockId = blockId;
            blockProverOutput.output = blockProvedResultStr;
            await queryRunner.manager.save(blockProverOutput);

            await queryRunner.commitTransaction();

        } catch (error) {
            logger.error(error);
            await queryRunner.rollbackTransaction();

        } finally {
            await queryRunner.release();
        }

        /*
        // check if align with AnomixRollupContract's onchain states, then it must be the lowese PENDING L2Block.
        const rollupContractAddr = PublicKey.fromBase58(config.rollupContractAddress);
        await syncAcctInfo(rollupContractAddr);
        const rollupContract = new AnomixRollupContract(rollupContractAddr);
        if (block?.dataTreeRoot0 == rollupContract.state.get().dataRoot.toString()) { // check here
            this.callRollupContract(blockId, blockProvedResultStr);
        }
        */

        logger.info('whenL2BlockComeback: done');

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
        });
        */
    }

    async callRollupContract(blockId: number, blockProvedResultStr?: string) {
        // load BlockProvedResult regarding 'blockId' from db
        const connection = getConnection();
        const blockRepo = connection.getRepository(Block);
        const block = (await blockRepo.findOne({ where: { id: blockId } }))!;

        const blockProverOutputRepo = connection.getRepository(BlockProverOutput);
        if (!blockProvedResultStr) {
            const blockProvedResult = (await blockProverOutputRepo.findOne({ where: { blockId }, order: { createdAt: 'DESC' } }))!;
            blockProvedResultStr = blockProvedResult.output;
        }

        const rollupProof = RollupProof.fromJSON(JSON.parse(blockProvedResultStr));
        const output = rollupProof.publicOutput;
        const signMessage = BlockProveOutput.toFields(output);
        const operatorSign = Signature.create(PrivateKey.fromBase58(config.operatorPrivateKey), signMessage);

        let addr = PublicKey.fromBase58(config.entryContractAddress);
        await syncAcctInfo(addr);// fetch account.
        const entryContract = new AnomixEntryContract(addr);
        const entryDepositRoot = entryContract.depositState.get().depositRoot;
        // assert(entryDepositRoot.toString() == block.depositRoot);

        // send to proof-generator for 'AnomixRollupContract.updateRollupState'
        // construct proofTaskDto
        const proofTaskDto: ProofTaskDto<any, any> = {
            taskType: ProofTaskType.ROLLUP_FLOW,
            index: {
                blockId,
                uuid: randomUUID().toString()
            },
            payload: {
                flowId: undefined,
                taskType: FlowTaskType.ROLLUP_CONTRACT_CALL,
                data: {
                    feePayer: PrivateKey.fromBase58(config.txFeePayerPrivateKey).toPublicKey().toBase58(),
                    fee: config.l1TxFee,// 0.2 Mina as fee
                    operatorSign,
                    entryDepositRoot,
                    proof: blockProvedResultStr
                }
            }
        }

        const fileName = './ROLLUP_CONTRACT_CALL_proofTaskDto_' + proofTaskDto.index.uuid + '_proofReq_' + getDateString() + '.json';
        fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
        logger.info(`save proofTaskDto into ${fileName}`);

        // send to proof-generator to trigger ROLLUP_CONTRACT
        await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
            if (r.data.code == 1) {
                throw new Error(r.data.msg);
            }
        });
        logger.info('callRollupContract done');
    }

    async whenL1TxComeback(blockId: number, tx: any) {
        // sign and broadcast it.
        const l1Tx = Mina.Transaction.fromJSON(JSON.parse(tx));
        l1Tx.transaction.feePayer.lazyAuthorization = { kind: 'lazy-signature' };
        await l1Tx.sign([PrivateKey.fromBase58(config.txFeePayerPrivateKey)]);

        await l1Tx.send().then(async txHash => {// TODO what if it fails currently!
            const txHash0 = txHash.hash()!;

            if ((!txHash0)) {
                logger.warn('error: broadcast anomixRollupContract\'s l1Tx failed!!!');
                return;
            }

            // insert L1 tx into db, underlying 
            const connection = getConnection();
            const queryRunner = connection.createQueryRunner();
            await queryRunner.startTransaction();
            try {
                const blockRepo = connection.getRepository(Block);
                blockRepo.update({ id: blockId }, { l1TxHash: txHash0 });

                // save task for 'Tracer-Watcher' and also save to task for 'Tracer-Watcher'
                const task = new Task();
                task.targetId = blockId;
                task.status = TaskStatus.PENDING;
                task.taskType = TaskType.ROLLUP;
                task.txHash = txHash0;
                await queryRunner.manager.save(task);

                await queryRunner.commitTransaction();
            } catch (error) {
                logger.error(error);
                await queryRunner.rollbackTransaction();
            } finally {
                await queryRunner.release();
            }

        }).catch(reason => {
            // TODO log it
            logger.info('whenL1TxComeback failed!', 'reason: ', JSON.stringify(reason));
        });
    }

}
