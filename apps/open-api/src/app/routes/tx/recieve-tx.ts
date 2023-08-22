import { BaseResponse, L2TxReqDtoSchema, L2TxReqDto, EncryptedNote, SequencerStatus } from '@anomix/types'
import { getConnection, In } from 'typeorm';
import { FastifyPlugin } from "fastify";
import httpCodes from "@inip/http-codes";
import { Account, MemPlL2Tx, WithdrawInfo } from '@anomix/dao'
import { RequestHandler } from '@/lib/types';
import { ActionType, JoinSplitProof, ValueNote } from "@anomix/circuits";
import config from "@/lib/config";
import { verify, Field } from "snarkyjs";
import { $axiosCoordinator, $axiosSeq } from '@/lib/api';

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
    const l2TxReqDto = req.body;

    // validate tx's proof
    const joinSplitProof = JoinSplitProof.fromJSON(l2TxReqDto.proof);
    const ok = await verify(joinSplitProof, config.joinSplitVK);
    if (!ok) {
        return { code: 1, data: undefined, msg: 'proof verify failed!' }
    }

    if (Number(joinSplitProof.publicOutput.txFee) < config.floorMpTxFee) {
        return { code: 1, data: undefined, msg: 'txFee not enough!' }
    }

    // check if nullifier1&2 is not on nullifier_tree
    const nullifier1 = joinSplitProof.publicOutput.nullifier1.toString();
    const nullifier2 = joinSplitProof.publicOutput.nullifier2.toString();
    const rs = await $axiosSeq.post<BaseResponse<Map<string, string>>>('/existence/nullifiers', [nullifier1, nullifier2]).then(r => {
        return r.data.data
    })
    if (rs!.get(nullifier1) != '-1' || rs!.get(nullifier2) != '-1') {
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
    const actionType = joinSplitProof.publicOutput.actionType;
    if (actionType.equals(ActionType.WITHDRAW)) {
        withdrawNote = ValueNote.fromJSON(l2TxReqDto.extraData.withdrawNote as any) as any;// TODO need check!!
        if (joinSplitProof.publicOutput.outputNoteCommitment1.equals(withdrawNote.commitment()).not()) {
            return { code: 1, data: 'withdrawNote\'s commitment is not aligned with tx.outputNoteCommitment1', msg: '' }
        }

    } else if (actionType.equals(ActionType.ACCOUNT)) {
        const aliasHash = l2TxReqDto.extraData.aliasHash;
        const acctPk = l2TxReqDto.extraData.acctPk;
        if (aliasHash && acctPk) {// true: registration
            if (Field.from(aliasHash).equals(joinSplitProof.publicOutput.nullifier1).not()
                .and(Field.from(acctPk).equals(joinSplitProof.publicOutput.nullifier2))) {
                throw req.throwError(httpCodes.BAD_REQUEST, { data: 'verify failed!' })
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

            const memPlL2TxRepository = connection.getRepository(MemPlL2Tx);

            let mpL2Tx = MemPlL2Tx.fromJoinSplitOutput(joinSplitProof.publicOutput);
            const outputNote1: EncryptedNote = l2TxReqDto.extraData.outputNote1;
            const outputNote2 = l2TxReqDto.extraData.outputNote2;
            mpL2Tx.encryptedData1 = JSON.stringify(outputNote1);
            if (outputNote2) {// no encryptedData if DUMMY_NOTE
                mpL2Tx.encryptedData2 = JSON.stringify(outputNote2);
            }
            mpL2Tx.proof = JSON.stringify(l2TxReqDto.proof); // TODO ??should be JSON.stringfy(joinSplitProof.proof)
            mpL2Tx = await memPlL2TxRepository.save(mpL2Tx);

            if (actionType.equals(ActionType.WITHDRAW)) {
                const withdrawInfoRepository = connection.getRepository(WithdrawInfo);
                const withdrawInfo = {
                    secret: withdrawNote.secret.toString(),
                    ownerPk: withdrawNote.ownerPk.toBase58(),
                    accountRequired: withdrawNote.accountRequired.toString(),
                    creatorPk: withdrawNote.creatorPk.toBase58(),
                    value: withdrawNote.value.toString(),
                    assetId: withdrawNote.assetId.toString(),
                    inputNullifier: withdrawNote.inputNullifier.toString(),
                    noteType: withdrawNote.noteType.toString(),
                    l2TxHash: mpL2Tx.txHash,
                    l2TxId: mpL2Tx.id
                } as WithdrawInfo;
                await withdrawInfoRepository.save(withdrawInfo);

            } else if (actionType.equals(ActionType.ACCOUNT)) {
                const aliasHash = l2TxReqDto.extraData.aliasHash;
                const acctPk = l2TxReqDto.extraData.acctPk;
                if (aliasHash && acctPk) {// true: registration
                    const accountRepository = connection.getRepository(Account);
                    const accountEntity = ({ aliasHash, acctPk } as unknown) as Account;
                    accountEntity.l2TxHash = mpL2Tx.txHash;
                    accountEntity.l2TxId = mpL2Tx.id;

                    accountRepository.save([accountEntity]);
                }
            }
            await queryRunner.commitTransaction();

            // if there is a high-fee l2tx, then notify coordinator to trigger seq
            if (Number(mpL2Tx.txFee) >= config.minMpTxFeeToGenBlock) {
                $axiosCoordinator.get('/tx/high-fee-exist');
            }

            return { code: 0, data: joinSplitProof.publicOutput.hash().toString(), msg: '' };
        } catch (err) {
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
