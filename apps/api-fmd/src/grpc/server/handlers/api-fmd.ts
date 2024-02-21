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
import { TaggingKey, Tag } from '@anomix/fmd';


const logger = getLogger('api-fmd');

export async function queryByTxFmd(fmdTagList: string[]) {
    const connection = getConnection();
    try {
        const txRepository = connection.getRepository(L2Tx)
        // then query confirmed tx collection
        const ctxList = await txRepository.find({
            // where: {
            //     fmdTag: In(fmdTagList)
            // }
        }) ?? [];

        const l2TxRespDtoList: L2TxRespDto[] = [];
        for (const tx of ctxList) {
            // fuzzy match fmdTag
            let testFlg = false;
            for (let index = 0; index < fmdTagList.length && !testFlg; index++) {
                const taggingKey = fmdTagList[index];
                testFlg = taggingKey.testTag(Tag.fromHex(tx.fmdTag));
            }
            if (!testFlg) {
                continue;
            }

            const blockRepository = connection.getRepository(Block)
            const block = await blockRepository.findOne({ select: ['createdAt', 'finalizedAt'], where: { id: tx.blockId } });

            const { updatedAt, createdAt, proof, encryptedData1, encryptedData2, ...restObj } = tx;
            const txDto = (restObj as any) as L2TxRespDto;

            txDto.finalizedTs = block!.finalizedAt?.getTime();
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

            l2TxRespDtoList.push(txDto);
        }

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
