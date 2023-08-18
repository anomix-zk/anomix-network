
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, RollupTaskDto, RollupTaskDtoSchma, RollupTaskType } from "@anomix/types";
import { $axiosDeposit, $axiosSeq } from "@/lib/api";
import { Field, PublicKey } from 'snarkyjs';
import { AnomixRollupContract } from "@anomix/circuits";
import { syncAcctInfo } from "@anomix/utils";
import config from "@/lib/config";
import { getConnection } from "typeorm";
import { Block } from "@anomix/dao";

/**
 * * when join-split_deposit done, notify coordinator;
 * * when L2Block_proved done, notify coordinator;
 */
export const proofNotify: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/rollup/proof-notify",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<RollupTaskDto<any, any>, null> = async function (
    req,
    res
): Promise<BaseResponse<any>> {
    try {
        const dto = req.body;
        const blockId = req.body.payload as number;

        let respondData: any = undefined;

        if (dto.taskType == RollupTaskType.DEPOSIT_PROCESS) {// when join-split_deposit done, coordinator trigger ROLLUP_PROCESSOR to start rolluping; 

            // trigger ROLLUP_PROCESSOR to start rolluping; 
            dto.taskType = RollupTaskType.ROLLUP_PROCESS;
            await $axiosSeq.post<BaseResponse<string>>('/rollup/proof-trigger', dto);

        } else if (dto.taskType == RollupTaskType.ROLLUP_PROCESS) {// when L2Block_proved done, coordinator trigger ROLLUP_PROCESSOR to invoke AnomixRollupContract; 
            const rollupContractAddr = PublicKey.fromBase58(config.rollupContractAddress);
            await syncAcctInfo(rollupContractAddr);
            const rollupContract = new AnomixRollupContract(rollupContractAddr);
            // check if align with AnomixRollupContract's onchain states, then it must be the lowese PENDING L2Block.
            await getConnection().getRepository(Block)
                .findOne({ where: { id: blockId } })
                .then(async block => {
                    if (block?.dataTreeRoot0 == rollupContract.state.get().dataRoot.toString()) { // check here
                        dto.taskType = RollupTaskType.ROLLUP_CONTRACT_CALL;
                        respondData = dto;
                    }
                })
        }

        return { code: 0, data: respondData, msg: '' };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'when (join-split_deposit is done || L2Block_prove is done), notify coordinator',
    tags: ['ROLLUP'],
    body: {
        type: (RollupTaskDtoSchma as any).type,
        properties: (RollupTaskDtoSchma as any).properties,
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: 'string',
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
