import { BaseResponse, L2TxReqDtoSchema, L2TxReqDto, EncryptedNote, SequencerStatus, L2TxStatus } from '@anomix/types'
import { getConnection, In } from 'typeorm';
import { FastifyPlugin } from "fastify";
import httpCodes from "@inip/http-codes";
import { Account, MemPlL2Tx, WithdrawInfo } from '@anomix/dao'
import { RequestHandler } from '@/lib/types';
import { ActionType, JoinSplitProof, ValueNote } from "@anomix/circuits";
import config from "@/lib/config";
import { verify, Field, PublicKey, Poseidon, UInt64 } from "o1js";
import { $axiosCoordinator, $axiosSeq } from '@/lib/api';
import { getLogger } from '@/lib/logUtils';

const logger = getLogger('recieveTx');

/**
* 供client发送L2 tx
*  ① 如果是withdraw, 则返回url
*/
export const recieveTx: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx",
        schema,
        handler
    })
}

export const handler: RequestHandler<L2TxReqDto, null> = async function (req, res): Promise<BaseResponse<string>> {
    logger.info(`a new tx is comming in...`);
    const l2TxReqDto = req.body;
    logger.info(req.body);

    let joinSplitProof: JoinSplitProof = undefined as any;
    try {
        // validate tx's proof
        joinSplitProof = JoinSplitProof.fromJSON(l2TxReqDto.proof);
    } catch (error) {
        logger.info('joinSplitProof deserialization failed!');
        logger.error(error);

        return { code: 1, data: undefined, msg: 'joinSplitProof deserialization failed!' }
    }

    const ok = await verify(joinSplitProof, config.joinSplitProverVK);// TODO

    if (!ok) {
        logger.info('proof verify failed!');
        return { code: 1, data: undefined, msg: 'proof verify failed!' }
    }

    const actionType = joinSplitProof.publicOutput.actionType;
    if (actionType.equals(ActionType.ACCOUNT).not().toBoolean()
        && Number(joinSplitProof.publicOutput.txFee) < config.floorMpTxFee) {
        logger.info('txFee not enough!');

        return { code: 1, data: undefined, msg: 'txFee not enough!' }
    }

    // check if nullifier1&2 is not on nullifier_tree
    const nullifier1 = joinSplitProof.publicOutput.nullifier1.toString();
    const nullifier2 = joinSplitProof.publicOutput.nullifier2.toString();
    const rs = await $axiosSeq.post<BaseResponse<any>>('/existence/nullifiers', [nullifier1, nullifier2]).then(r => {
        return new Map(Object.entries(r.data.data));
    })
    if (rs!.get(nullifier1) != '' || rs!.get(nullifier2) != '') {
        logger.info('double spending: nullifier1 or nullifier2 is used');

        return { code: 1, data: undefined, msg: 'double spending: nullifier1 or nullifier2 is used' }
    }

    /*
        ================================ below checks should be mv to Rollup section ================================
        //  check if nullifier1 or nullifier2 has been already used in tx of MemoryPool, and if not at rollup status, then rid the ones with less txFee, 
        try {
            const connection = getConnection();
            const memPlL2TxRepository = connection.getRepository(MemPlL2Tx);
            const mpL2TxList0 = (await memPlL2TxRepository.find({ where: { nullifier1: In([nullifier1, nullifier2]) } })) ?? [];
            const mpL2TxList1 = (await memPlL2TxRepository.find({ where: { nullifier2: In([nullifier1, nullifier2]) } })) ?? [];
            const mergeList = [...mpL2TxList0, ...mpL2TxList1];

            // if at rollup status, then rid this tx.
            const seqStatus = await $axios.get<BaseResponse<number>>('/network/status').then(r => {
                return r.data.data
            })
            if (seqStatus == SequencerStatus.AtRollup) {
                return { code: 1, data: '(AtRollup)double spending: nullifier1 or nullifier2 is used', msg: '' }
            }

        } catch (error) {
            throw req.throwError(httpCodes.BAD_REQUEST, { data: 'Internal server error' })
        }
        ================================ above checks should be mv to Rollup section ================================
    */

    let withdrawNote: ValueNote = {} as any;
    if (actionType.equals(ActionType.WITHDRAW).toBoolean()) {
        withdrawNote = new ValueNote({
            secret: Field(l2TxReqDto.extraData.withdrawNote!.secret),
            ownerPk: PublicKey.fromBase58(l2TxReqDto.extraData.withdrawNote!.ownerPk),
            accountRequired: Field(l2TxReqDto.extraData.withdrawNote!.accountRequired),
            assetId: Field(l2TxReqDto.extraData.withdrawNote!.assetId),
            inputNullifier: Field(l2TxReqDto.extraData.withdrawNote!.inputNullifier),
            noteType: Field(l2TxReqDto.extraData.withdrawNote!.noteType),
            creatorPk: PublicKey.empty(),
            value: UInt64.from(l2TxReqDto.extraData.withdrawNote!.value)
        });
        if (joinSplitProof.publicOutput.outputNoteCommitment1.equals(withdrawNote.commitment()).not().toBoolean()) {
            logger.info('withdrawNote\'s commitment is not aligned with tx.outputNoteCommitment1');
            return { code: 1, data: 'withdrawNote\'s commitment is not aligned with tx.outputNoteCommitment1', msg: '' }
        }

    } else if (actionType.equals(ActionType.ACCOUNT).toBoolean()) {
        const aliasHash = l2TxReqDto.extraData.aliasHash;
        const acctPk = l2TxReqDto.extraData.acctPk;
        if (aliasHash && acctPk) {// true: registration
            if (Poseidon.hash([Field.from(aliasHash)]).equals(joinSplitProof.publicOutput.nullifier1).not()
                .and(
                    Poseidon.hash(PublicKey.fromBase58(acctPk).toFields()).equals(joinSplitProof.publicOutput.nullifier2)
                ).toBoolean()) {
                logger.info('nullifier1/2 is not aligned with hash(aliasHash/acctPk)');
                return { code: 1, data: 'nullifier1/2 is not aligned with hash(aliasHash/acctPk)', msg: '' }
            }
        }
    }

    try {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        try {
            await queryRunner.connect();
            // !! in a transaction!!
            await queryRunner.startTransaction();

            let mpL2Tx = MemPlL2Tx.fromJoinSplitOutput(joinSplitProof.publicOutput);
            logger.info(`process mpL2Tx: ${mpL2Tx.txHash}...`);

            mpL2Tx.status = L2TxStatus.PENDING;
            const outputNote1 = l2TxReqDto.extraData.outputNote1;
            const outputNote2 = l2TxReqDto.extraData.outputNote2;
            mpL2Tx.encryptedData1 = outputNote1 ? JSON.stringify(outputNote1) : undefined as any;
            mpL2Tx.encryptedData2 = outputNote2 ? JSON.stringify(outputNote2) : undefined as any;
            mpL2Tx.proof = JSON.stringify(l2TxReqDto.proof); // TODO ??should be JSON.stringfy(joinSplitProof.proof)
            mpL2Tx = await queryRunner.manager.save(mpL2Tx);

            if (actionType.equals(ActionType.WITHDRAW).toBoolean()) {
                let withdrawInfo = new WithdrawInfo();
                withdrawInfo.secret = withdrawNote.secret.toString();
                withdrawInfo.ownerPk = withdrawNote.ownerPk.toBase58();
                withdrawInfo.accountRequired = withdrawNote.accountRequired.toString();
                withdrawInfo.creatorPk = withdrawNote.creatorPk.toBase58();
                withdrawInfo.value = withdrawNote.value.toString();
                withdrawInfo.assetId = withdrawNote.assetId.toString();
                withdrawInfo.inputNullifier = withdrawNote.inputNullifier.toString();
                withdrawInfo.noteType = withdrawNote.noteType.toString();
                withdrawInfo.l2TxHash = mpL2Tx.txHash;
                withdrawInfo.l2TxId = mpL2Tx.id;
                withdrawInfo = await queryRunner.manager.save(withdrawInfo);

            } else if (actionType.equals(ActionType.ACCOUNT).toBoolean()) {
                const aliasHash = l2TxReqDto.extraData.aliasHash;
                const acctPk = l2TxReqDto.extraData.acctPk;
                if (aliasHash && acctPk) {// true: registration
                    let account = new Account();
                    account.aliasHash = aliasHash;
                    account.acctPk = acctPk;
                    account.l2TxHash = mpL2Tx.txHash;
                    account.l2TxId = mpL2Tx.id;
                    account.encrptedAlias = l2TxReqDto.extraData.aliasInfo!;
                    account = await queryRunner.manager.save(account);
                }
            }

            await queryRunner.commitTransaction();
            logger.info(`mpL2Tx: ${mpL2Tx.txHash} is done.`);

            // if there is a high-fee l2tx, then notify coordinator to trigger seq
            if (Number(mpL2Tx.txFee) >= config.minMpTxFeeToGenBlock) {
                $axiosCoordinator.get('/tx/high-fee-exist').catch(e => {
                    logger.warn('call /tx/high-fee-exist failed, l2tx hash: ' + mpL2Tx.txHash);
                });
            }

            return { code: 0, data: joinSplitProof.publicOutput.hash().toString(), msg: '' };
        } catch (err) {
            logger.error(err);
            console.error(err);

            await queryRunner.rollbackTransaction();

            throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
        } finally {
            await queryRunner.release();
        }
    } catch (error) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }

}

const schema = {
    description: 'recieve tx from client',
    tags: ["L2Tx"],
    body: {
        type: "object",
        properties: (L2TxReqDtoSchema as any).properties,
        required: (L2TxReqDtoSchema as any).required
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'string'
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
