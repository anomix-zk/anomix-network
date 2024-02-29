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
import { $axiosSeq } from "../../../lib/api";


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

/**
 * during the entire WITHDRAWAL flow, need ganruantee being under the same data_tree root.
 */
export async function checkPoint() {
    // query current latest block height
    const blockRepository = getConnection().getRepository(Block);
    // query latest block
    const blockEntity = (await blockRepository.find({
        select: [
            'id'
        ],
        where: {
            status: BlockStatus.CONFIRMED
        },
        order: {
            id: 'DESC'
        },
        take: 1
    }))[0];

    return blockEntity!.id;
}

export async function queryTxByNoteHashx(dto: string[]) {

    const notehashes = dto

    try {
        const txHashList = await $axiosSeq.post<BaseResponse<string[]>>('/tx/notehashes', notehashes).then(r => {
            return r.data.data
        });

        const connection = getConnection();
        const txRepository = connection.getRepository(L2Tx)
        // then query confirmed tx collection
        const ctxList = await txRepository.find({
            where: {
                txHash: In(txHashList!)
            }
        }) ?? [];

        const l2TxRespDtoList = await Promise.all(ctxList.map(async tx => {
            const blockRepository = connection.getRepository(Block)
            const block = await blockRepository.findOne({ select: ['createdAt', 'finalizedAt'], where: { id: tx.blockId } });

            const { updatedAt, createdAt, proof, encryptedData1, encryptedData2, ...restObj } = tx;
            const txDto = (restObj as any) as L2TxRespDto;
            txDto.finalizedTs = block!.finalizedAt.getTime();
            txDto.createdTs = block!.createdAt.getTime();

            txDto.extraData = {} as any;
            txDto.extraData.outputNote1 = encryptedData1 ? JSON.parse(encryptedData1) : undefined;
            txDto.extraData.outputNote2 = encryptedData2 ? JSON.parse(encryptedData2) : undefined;

            if (tx.actionType == ActionType.WITHDRAW.toString()) {// if Withdrawal
                // query WithdrawInfoDto
                const withdrawNoteRepo = connection.getRepository(WithdrawInfo);
                const { createdAt, updatedAt, finalizedAt, blockIdWhenL1Tx, ...restPro } = (await withdrawNoteRepo.findOne({ where: { l2TxHash: txDto.txHash } }))!;
                txDto.extraData.withdrawNote = restPro as any as WithdrawInfoDto;
                txDto.extraData.withdrawNote.createdTs = txDto.createdTs;// !!!

            } else if (tx.actionType == ActionType.ACCOUNT.toString()) {// if Account
                // query Account
                const accountRepo = connection.getRepository(Account);
                const account = await accountRepo.findOne({ where: { l2TxHash: txDto.txHash } });
                txDto.extraData.acctPk = account?.acctPk;
                txDto.extraData.aliasHash = account?.aliasHash;
                txDto.extraData.aliasInfo = account?.encrptedAlias;
            }

            return txDto;
        }));

        return {
            code: 0,
            data: l2TxRespDtoList,
            msg: ''
        };
    } catch (err) {
        logger.error(err);
        console.error(err);

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryTxByNullifier(dto: string[]) {

    const notehashes = dto;

    try {
        // request sequencer for the result.
        const rs = await $axiosSeq.post<BaseResponse<L2Tx[]>>('/tx/nullifiers', notehashes).then(r => {
            return r.data
        })

        return rs;
    } catch (err) {
        console.error(err);
        logger.error(err);
        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function queryUserTreeInfo(dto: { tokenId: string, ownerPk: string, includeUncommit: boolean }) {
    const { tokenId, ownerPk, includeUncommit } = dto;
    try {
        const rs = await $axiosSeq.post<BaseResponse<{
            treeId: string,
            includeUncommit: boolean,
            depth: number,
            leafNum: string,
            treeRoot: string
        }>>('/user-nullifier-tree', { tokenId, ownerPk, includeUncommit }).then(r => {
            return r.data
        })
        return rs;
    } catch (err) {
        console.error(err);
        logger.error(err);

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}
