
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { RequestHandler } from '@/lib/types'
import { Block, WithdrawInfo } from "@anomix/dao";
import { BaseResponse, WithdrawNoteStatus, ProofTaskDto, ProofTaskType, ProofTaskDtoSchma } from "@anomix/types";
import { PublicKey } from "o1js";
import fs from "fs";

/**
* recieve proof result from proof-generator
*/
export const proofCallback: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/proof-result",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}


const handler: RequestHandler<ProofTaskDto<any, any>, null> = async function (
    req,
    res
): Promise<BaseResponse<string>> {
    const { taskType, index, payload } = req.body

    if (taskType == ProofTaskType.ROLLUP_FLOW) {

        process.send!(req.body);

    } else {// FIRST_WITHDRAW || WITHDRAW
        const connection = getConnection();
        const withdrawInfoRepository = connection.getRepository(WithdrawInfo)
        try {
            const withdrawInfo = (await withdrawInfoRepository.findOne({
                where: {
                    id: index.withdrawInfoId
                }
            }))!;

            // query current latest block height
            const blockRepository = connection.getRepository(Block);
            // query latest block
            const blockEntity = (await blockRepository.find({
                select: [
                    'id'
                ],
                order: {
                    id: 'DESC'
                },
                take: 1
            }))[0];
            const currentBlockHeight = blockEntity.id;

            if (withdrawInfo.blockIdWhenL1Tx != currentBlockHeight) {// outdated, should revert status!
                withdrawInfo.status = WithdrawNoteStatus.PENDING;

                // loadTree from withdrawDB & obtain merkle witness
                await this.withdrawDB.loadTree(PublicKey.fromBase58(withdrawInfo.ownerPk), withdrawInfo.assetId);// the tree must be in cache now!
                await this.withdrawDB.rollback();// rollup it!
                this.withdrawDB.reset();// the total flow is ended.
            } else {
                withdrawInfo.l1TxBody = JSON.stringify(payload);
                // withdrawInfo?.l1TxHash = payload.   // TODO how to pre_calc tx.id??
            }

            // save l1TxBody
            await withdrawInfoRepository.save(withdrawInfo);

        } catch (err) {
            throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
        }
    }

    return {
        code: 0,
        data: '',
        msg: 'in queue'
    };
}

const schema = {
    description: 'recieve withdraw note\'s proof result from proof-generator',
    tags: ["Proof"],
    body: {
        type: "object",
        properties: (ProofTaskDtoSchma as any).properties,
    },
    response: {
        200: {
            type: "object",
            properties: {
                code: {
                    type: 'number',
                    description: '0: success, 1: failure.'
                },
                data: {
                    type: 'string'
                },
                msg: {
                    type: 'string',
                    description: 'the reason or msg related to \'code\''
                }
            },
        }
    }
}

