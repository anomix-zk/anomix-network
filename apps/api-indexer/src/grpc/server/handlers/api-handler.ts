import { BaseResponse, BlockStatus, DepositProcessingSignal, DepositTransCacheType, FlowTask, FlowTaskType, L2TxStatus, MerkleProofDto, MerkleTreeId, ProofTaskDto, ProofTaskType, ProofVerifyReqDto, ProofVerifyReqType, RollupTaskDto, WithdrawAssetReqDto, WithdrawEventFetchRecordStatus, WithdrawNoteStatus } from "@anomix/types";
import process from "process";
import { DATA_TREE_HEIGHT, JoinSplitProof, LowLeafWitnessData, NullifierMerkleWitness, NULLIFIER_TREE_HEIGHT, ROOT_TREE_HEIGHT, WithdrawNoteWitnessData } from "@anomix/circuits";
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


const logger = getLogger('api-handler');

export async function checkAcctViewKeyRegistered(dto: { acctViewKey: string, includePending: boolean }) {

    const { acctViewKey, includePending } = dto

    const connection = getConnection();
    const accountRepository = connection.getRepository(Account)
    try {
        let code = 0;   // registered!
        let data = true;
        let msg = '';
        const account = await accountRepository.findOne({ where: { acctPk: acctViewKey } });
        if (account /* && includePending */) {
            const mpL2TxRepo = connection.getRepository(MemPlL2Tx);
            const mpL2Tx = await mpL2TxRepo.findOne(account.l2TxHash);
            if (!mpL2Tx) {
                const l2TxRepo = connection.getRepository(L2Tx);
                const l2Tx = await l2TxRepo.findOne(account.l2TxHash);
                if (!l2Tx) {
                    code = 1;   // not registered!
                    data = false;
                }

            } else {
                const status = (mpL2Tx)!.status;
                if (status == L2TxStatus.FAILED) {
                    code = 1;   // not registered!
                    data = false;
                } else if (status == L2TxStatus.PENDING) {
                    msg = 'pending';
                }
            }
        } else {
            data = false;
            msg = 'no this account-viewing-key!'
        }

        return {
            code,
            data,
            msg
        };

    } catch (err) {
        logger.error(err);

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

export async function checkAliasAlignWithViewKey(dto: { aliasHash: string, acctViewKey: string, includePending: boolean }) {

    const { aliasHash, acctViewKey, includePending } = dto

    const connection = getConnection();
    const accountRepository = connection.getRepository(Account)
    try {
        let code = 1;
        let data = false;
        let msg = 'account key is not aligned with alias!';

        const account = await accountRepository.findOne({ where: { aliasHash } });

        if (account) {
            if (account.acctPk == acctViewKey) {
                const mpL2TxRepo = connection.getRepository(MemPlL2Tx);
                const mpL2tx = await mpL2TxRepo.findOne(account.l2TxHash);
                if (mpL2tx) {
                    const status = mpL2tx.status;
                    if (status == L2TxStatus.FAILED) {
                        code = 1;   // not registered!
                        data = false;
                        msg = 'last register l2tx is failed!'
                    } else if (includePending) {
                        code = 0;
                        data = true;
                        if (status == L2TxStatus.PENDING) {
                            msg = 'last register l2tx is pending.';
                        }
                    }
                } else {
                    code = 0;
                    data = true;
                    msg = 'account key is aligned with alias!';
                }
            }
        }

        return {
            code,
            data,
            msg
        };

    } catch (err) {
        logger.error(err);

        // throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

