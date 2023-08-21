
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, DepositStatus, L2TxStatus } from "@anomix/types";
import { getConnection } from "typeorm";
import { DepositCommitment, MemPlL2Tx } from "@anomix/dao";
import { ActionType, DUMMY_FIELD } from "@anomix/circuits";

/**
 * trigger actions to mempool l2tx
 */
export const actionToMpL2Tx: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/rollup/action-to-mempl-tx/:transId",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, { transId: number }> = async function (
    req,
    res
): Promise<BaseResponse<boolean>> {
    try {
        const transId = req.params;

        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        queryRunner.startTransaction();
        try {
            const dcRepo = connection.getRepository(DepositCommitment);

            const vDepositTxList: MemPlL2Tx[] = [];
            const dcList = await dcRepo.find({ where: { depositTreeTransId: transId } });
            dcList!.forEach(dc => {
                dc.status = DepositStatus.MARKED;

                // pre-construct depositTx
                vDepositTxList.push({
                    actionType: ActionType.DEPOSIT.toString(),
                    nullifier1: DUMMY_FIELD.toString(),
                    nullifier2: DUMMY_FIELD.toString(),
                    outputNoteCommitment1: dc.depositNoteCommitment,
                    outputNoteCommitment2: DUMMY_FIELD.toString(),
                    publicValue: dc.depositValue,
                    publicOwner: dc.sender,
                    publicAssetId: dc.assetId,
                    depositIndex: dc.depositNoteIndex,
                    txFee: '0',
                    txFeeAssetId: dc.assetId,
                    encryptedData1: dc.encryptedNote,
                    status: L2TxStatus.PENDING
                } as MemPlL2Tx);
            });

            dcRepo.save(dcList);
            // insert depositTx into memorypool
            const memPlL2TxRepo = connection.getRepository(MemPlL2Tx);
            await memPlL2TxRepo.save(vDepositTxList);

            queryRunner.commitTransaction();
        } catch (error) {
            console.error(error);
            throw error;
        }



        return { code: 0, data: true, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'trigger deposit actions rollup',
    tags: ['Rollup'],
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'number'
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
