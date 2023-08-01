import { BaseResponse, L2TxReqDtoSchema, L2TxReqDto, EncryptedNote } from '@anomix/types'
import { getConnection } from 'typeorm';
import { FastifyPlugin } from "fastify";
import httpCodes from "@inip/http-codes";
import { Account, MemPlL2Tx, WithdrawInfo } from '@anomix/dao'
import { RequestHandler } from '@/lib/types';
import { ActionType, JoinSplitProof, ValueNote } from "@anomix/circuits";
import config from "@/lib/config";
import { verify, Field } from "snarkyjs";
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
        throw req.throwError(httpCodes.BAD_REQUEST, { data: 'verify failed!' })
    }

    // TODO check if nullifier1&2 is not on nullifier_tree

    // TODO check if nullifier1 or nullifier2 has been already used in tx of MemoryPool, then rid the one with less txFee

    let withdrawNote: ValueNote = {} as ValueNote;
    const actionType = joinSplitProof.publicOutput.actionType;
    if (actionType.equals(ActionType.WITHDRAW)) {
        // TODO const withdrawNote = ValueNote.fromJSON(l2TxReqDto.extraData.withdrawNote);
        withdrawNote = {} as any;
        if (joinSplitProof.publicOutput.outputNoteCommitment1.equals(withdrawNote.commitment()).not()) {
            throw req.throwError(httpCodes.BAD_REQUEST, { data: 'verify failed!' })
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
        await queryRunner.connect();

        try {
            // !! in a transaction!!
            await queryRunner.startTransaction();

            queryRunner.startTransaction();

            const memPlL2TxRepository = connection.getRepository(MemPlL2Tx);

            const mpL2Tx = MemPlL2Tx.fromJoinSplitOutput(joinSplitProof.publicOutput);
            const outputNote1: EncryptedNote = l2TxReqDto.extraData.outputNote1;
            const outputNote2 = l2TxReqDto.extraData.outputNote2;
            mpL2Tx.encryptedData1 = JSON.stringify(outputNote1);
            if (outputNote2) {
                mpL2Tx.encryptedData2 = JSON.stringify(outputNote2);
            }
            mpL2Tx.proof = JSON.stringify(l2TxReqDto.proof); // TODO ??should be JSON.stringfy(joinSplitProof.proof)

            await memPlL2TxRepository.createQueryBuilder(undefined, queryRunner).insert().into(MemPlL2Tx).values([mpL2Tx]);

            if (actionType.equals(ActionType.WITHDRAW)) {
                const withdrawInfoRepository = connection.getRepository(WithdrawInfo);
                const withdrawInfo = (withdrawNote as unknown) as WithdrawInfo;
                withdrawInfo.l2TxHash = mpL2Tx.txHash;
                withdrawInfo.l2TxId = mpL2Tx.id;

                withdrawInfoRepository.createQueryBuilder(undefined, queryRunner).insert().into(WithdrawInfo).values([withdrawInfo]);

            } else if (actionType.equals(ActionType.ACCOUNT)) {
                const aliasHash = l2TxReqDto.extraData.aliasHash;
                const acctPk = l2TxReqDto.extraData.acctPk;
                if (aliasHash && acctPk) {// true: registration
                    const accountRepository = connection.getRepository(Account);
                    const accountEntity = ({ aliasHash, acctPk } as unknown) as Account;
                    accountEntity.l2TxHash = mpL2Tx.txHash;
                    accountEntity.l2TxId = mpL2Tx.id;

                    accountRepository.createQueryBuilder(undefined, queryRunner).insert().into(Account).values([accountEntity]);
                }
            }
            queryRunner.commitTransaction();

            return { code: 0, data: joinSplitProof.publicOutput.hash().toString(), msg: '' };
        } catch (err) {
            queryRunner.rollbackTransaction();

            throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
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
