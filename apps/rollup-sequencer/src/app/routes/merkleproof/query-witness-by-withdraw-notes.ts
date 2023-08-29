
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, MerkleProofDto, MerkleTreeId, WithdrawalWitnessDto, WithdrawalWitnessDtoSchema, WithdrawNoteStatus } from "@anomix/types";
import { getConnection } from "typeorm";
import { WithdrawInfo } from "@anomix/dao";
import { checkAccountExists } from "@anomix/utils";
import { PublicKey, Field } from "snarkyjs";

/**
 * query all Witness By WithdrawNotes
 */
export const queryWitnessByWithdrawNotes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/merklewitness/withdraw-commitment/:commitment",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

const handler: RequestHandler<null, string> = async function (
    req,
    res
): Promise<BaseResponse<WithdrawalWitnessDto>> {
    const withdrawCommitment = req.params;

    try {
        const rollupDataRoot = this.worldState.worldStateDB.getRoot(MerkleTreeId.SYNC_DATA_TREE, false).toString();

        const connection = getConnection();
        const withdrawInfoRepo = connection.getRepository(WithdrawInfo);
        const winfo = (await withdrawInfoRepo.findOne({
            where: {
                outputNoteCommitment: withdrawCommitment,
                status: WithdrawNoteStatus.PENDING
            }
        }))!

        if (!winfo) {
            return { code: 1, data: undefined, msg: 'cannot find the value note!' } as BaseResponse<WithdrawalWitnessDto>;
        }

        // check if it's the first withdraw
        let tokenId = winfo.assetId;
        const ownerPk = PublicKey.fromBase58(winfo.ownerPk);
        const { accountExists, account } = await checkAccountExists(ownerPk, Field(tokenId));

        const notFirst = !accountExists && account.zkapp?.appState[0] == Field(0);

        if (notFirst) {//if it's NOT the first withdraw
            // loadTree from withdrawDB & obtain merkle witness
            await this.withdrawDB.loadTree(ownerPk, tokenId);

        } else {// first withdraw, should deploy first
            return { code: 1, data: undefined, msg: 'please deploy WithdrawAccount first!' } as BaseResponse<WithdrawalWitnessDto>;
        }

        const { index: preIdx, alreadyPresent } = await this.withdrawDB.findIndexOfPreviousValue(Field(winfo.outputNoteCommitment), true);
        const preLeafData = await this.withdrawDB.getLatestLeafDataCopy(preIdx, true);

        const rs = {
            withdrawNoteWitnessData: {
                withdrawNote: winfo!.valueNote(),
                witness: (await this.worldState.worldStateDB.getSiblingPath(MerkleTreeId.SYNC_DATA_TREE, BigInt(winfo!.outputNoteCommitmentIdx), false))!.path.map(p => p.toString()),
                index: winfo!.outputNoteCommitmentIdx
            },
            lowLeafWitness: {
                leafData: {
                    value: preLeafData!.value.toString(),
                    nextIndex: preLeafData!.nextIndex.toString(),
                    nextValue: preLeafData!.nextValue.toString()
                },
                siblingPath: (await this.worldState.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, BigInt(winfo!.outputNoteCommitmentIdx), false))!.path.map(p => p.toString()),
                index: Field(preIdx).toString()
            },
            oldNullWitness: (await this.worldState.worldStateDB.getSiblingPath(MerkleTreeId.NULLIFIER_TREE, BigInt(winfo!.outputNoteCommitmentIdx), false))!.path.map(p => p.toString()),
            rollupDataRoot
        }

        await this.withdrawDB.reset();

        return { code: 0, data: rs, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query all Witness By WithdrawNotes',
    tags: ['NOTE'],
    params: {
        type: 'string'
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'object',
                    properties: WithdrawalWitnessDtoSchema.properties
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
