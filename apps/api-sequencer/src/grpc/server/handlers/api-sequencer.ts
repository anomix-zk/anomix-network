import { AssetInBlockReqDto, BlockDto, AssetsInBlockDto, BaseResponse, BlockStatus, DepositProcessingSignal, DepositTransCacheType, FlowTask, FlowTaskType, L2TxSimpleDto, L2TxStatus, MerkleProofDto, MerkleTreeId, ProofTaskDto, ProofTaskType, ProofVerifyReqDto, ProofVerifyReqType, RollupTaskDto, WithdrawAssetReqDto, WithdrawEventFetchRecordStatus, WithdrawInfoDto, WithdrawNoteStatus, L2TxRespDto } from "@anomix/types";
import process from "process";
import { ActionType, DATA_TREE_HEIGHT, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, NULLIFIER_TREE_HEIGHT, ROOT_TREE_HEIGHT, WithdrawNoteWitnessData } from "@anomix/circuits";
import { getLogger } from "@/lib/logUtils";
import config from "@/lib/config";
import { verify } from "o1js";
import { Account, Block, DepositProcessorSignal, DepositProverOutput, DepositTreeTrans, DepositTreeTransCache, L2Tx, MemPlL2Tx, WithdrawEventFetchRecord, WithdrawInfo } from '@anomix/dao';
import { getConnection, In } from "typeorm";
import { checkAccountExists } from "@anomix/utils";
import {
    Field,
    PublicKey,
    VerificationKey
} from 'o1js';
import { StandardIndexedTree } from "@anomix/merkle-tree";
import { randomUUID } from "crypto";
import { PrivateKey } from "o1js";
import fs from "fs";


const logger = getLogger('api-sequencer');


/**
 * withdrawAsset
 * @param dto 
 */
export async function withdrawAsset(dto: WithdrawAssetReqDto) {

    const { l1addr, noteCommitment } = dto

    const withdrawInfoRepository = getConnection().getRepository(WithdrawInfo)
    try {
        const previousWithdrawInfoList = await withdrawInfoRepository.find({
            where: {
                ownerPk: l1addr,
                assetId: '1',// default Mina
            }
        }) ?? [];

        if (previousWithdrawInfoList.length == 0) {
            return {
                code: 1,
                data: '',
                msg: 'no PENDING withdraw info found!'
            };
        }

        const processingOne = previousWithdrawInfoList.filter(wi => {
            return wi.status == WithdrawNoteStatus.PROCESSING;
        })[0];
        // due to need update USER_NULLIFIER_TREE root at user's tokenAccount<L1Addr, AssetID>, withdrawal should be in sequence.
        if (processingOne.outputNoteCommitment == noteCommitment) {
            return {
                code: 1,
                data: '',
                msg: `Please wait for last withdraw of <${l1addr}, assetId:${processingOne!.assetId}, assetNote: ${noteCommitment}> to be done!`
            };
        }

        const targetOne = previousWithdrawInfoList.filter(wi => {
            return wi.outputNoteCommitment == noteCommitment;
        })[0];
        if (!(targetOne?.status == WithdrawNoteStatus.PENDING)) {
            return {
                code: 1,
                data: '',
                msg: 'no PENDING withdraw info found!'
            };
        }

        //send to 'Sequencer' for further handle.
        return await $axiosSeq.post<BaseResponse<string>>('/tx/withdraw', { l1addr, noteCommitment }).then(r => r.data);

    } catch (err) {
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}
