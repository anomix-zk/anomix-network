import { BaseResponse, BlockStatus, DepositProcessingSignal, FlowTask, FlowTaskType, MerkleProofDto, MerkleTreeId, ProofTaskDto, ProofTaskType, ProofVerifyReqDto, ProofVerifyReqType, RollupTaskDto, WithdrawAssetReqDto, WithdrawEventFetchRecordStatus, WithdrawNoteStatus } from "@anomix/types";
import process from "process";
import { $axiosProofGenerator, getDateString } from "@/lib";
import { DATA_TREE_HEIGHT, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, NULLIFIER_TREE_HEIGHT, ROOT_TREE_HEIGHT, WithdrawNoteWitnessData } from "@anomix/circuits";
import { getLogger } from "@/lib/logUtils";
import config from "@/lib/config";
import { verify } from "o1js";
import { Block, DepositProcessorSignal, DepositProverOutput, L2Tx, MemPlL2Tx, WithdrawEventFetchRecord, WithdrawInfo } from '@anomix/dao';
import { getConnection, In } from "typeorm";
import { checkAccountExists } from "@anomix/utils";
import {
    Field,
    PublicKey,
    VerificationKey
} from 'o1js';
import { StandardIndexedTree } from "@anomix/merkle-tree";
import { WorldState } from "@/worldstate";
import { randomUUID } from "crypto";
import { PrivateKey } from "o1js";
import fs from "fs";


const logger = getLogger('depositProcessor');

export async function triggerSeqDepositCommitment(worldState: WorldState) {
    try {
        // start a new flow! 
        await worldState.startNewFlow();

        return { code: 0, data: true, msg: '' };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}


export async function triggerContractCall(dto: { transId: number }) {
    try {
        const transId = dto.transId;

        const connection = getConnection();
        const depositProcessorSignalRepo = connection.getRepository(DepositProcessorSignal);
        const depositProcessorSignal = (await depositProcessorSignalRepo.findOne({ where: { type: 0 } }))!;

        if (depositProcessorSignal.signal == DepositProcessingSignal.CAN_TRIGGER_CONTRACT) {
            const depositProverOutputRepo = connection.getRepository(DepositProverOutput);
            const depositProverOutput = await depositProverOutputRepo.findOne({ where: { transId } });
            const proofTaskDto = {
                taskType: ProofTaskType.ROLLUP_FLOW,
                index: { uuid: randomUUID().toString() },
                payload: {
                    flowId: undefined as any,
                    taskType: FlowTaskType.DEPOSIT_UPDATESTATE,
                    data: {
                        transId,
                        feePayer: PrivateKey.fromBase58(config.txFeePayerPrivateKey).toPublicKey().toBase58(),
                        fee: 200_000_000,// 0.2 Mina as fee
                        data: JSON.parse(depositProverOutput!.output)
                    }
                } as FlowTask<any>
            } as ProofTaskDto<any, FlowTask<any>>;

            const fileName = './DEPOSIT_UPDATESTATE_proofTaskDto_proofReq' + getDateString() + '.json';
            fs.writeFileSync(fileName, JSON.stringify(proofTaskDto));
            logger.info(`save proofTaskDto into ${fileName}`);

            // trigger directly
            await $axiosProofGenerator.post<BaseResponse<string>>('/proof-gen', proofTaskDto).then(r => {
                if (r.data.code == 1) {
                    throw new Error(r.data.msg);
                }
            }).catch(reason => {
                console.log(reason);
            });
        }

        return {
            code: 0, data: '', msg: ''
        };
    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryLatestDepositTreeRoot(worldState: WorldState) {
    try {
        // if deposit_processor just send out a deposit-rollup L1tx that is not yet confirmed at Mina Chain, then return the latest DEPOSIT_TREE root !!
        // later if the seq-rollup L1Tx of the L2Block with this root is confirmed before this deposit-rollup L1tx (even though this case is rare), then the seq-rollup L1Tx fails!!
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        await queryRunner.startTransaction();
        try {
            const latestDepositTreeRoot = worldState.worldStateDB.getRoot(MerkleTreeId.DEPOSIT_TREE, true).toString();
            return {
                code: 0, data: latestDepositTreeRoot, msg: ''
            };
        } catch (error) {
            console.error(error);
            await queryRunner.rollbackTransaction();

        } finally {
            await queryRunner.release();
        }

        return {
            code: 1, data: undefined, msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}
