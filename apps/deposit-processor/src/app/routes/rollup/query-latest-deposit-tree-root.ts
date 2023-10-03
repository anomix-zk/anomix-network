
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { RequestHandler } from '@/lib/types'
import { BaseResponse, DepositTreeTransStatus, MerkleTreeId } from "@anomix/types";
import { type } from "os";
import { DepositTreeTrans, Task, TaskType } from "@anomix/dao";
import { getConnection } from "typeorm";

/**
 * query deposit-tree root
 */
export const queryLatestDepositTreeRoot: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/rollup/deposit-tree-root",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<null, null> = async function (
    req,
    res
): Promise<BaseResponse<string>> {
    try {
        /* single thread for both http-server and deposit_rollup, so no need to check if WorldState has an onging Flow  
        // check if WorldState has an onging Flow     
        if (this.worldState.ongingFlow) {
            return {
                code: 1, data: undefined, msg: ''
            };
        } 
        */

        // if deposit_processor just send out a deposit-rollup L1tx that is not yet confirmed at Mina Chain, then return the latest DEPOSIT_TREE root !!
        // later if the seq-rollup L1Tx of the L2Block with this root is confirmed before this deposit-rollup L1tx (even though this case is rare), then the seq-rollup L1Tx fails!!
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();

        await queryRunner.startTransaction();
        try {
            const depositTrans = await queryRunner.manager.findOne(DepositTreeTrans, { where: { status: DepositTreeTransStatus.PROVED }, order: { id: 'ASC' } });
            const task = await await queryRunner.manager.findOne(Task, { where: { taskType: TaskType.DEPOSIT, targetId: depositTrans?.id } });
            if (task) {
                return {
                    code: 0, data: depositTrans?.nextDepositRoot, msg: ''
                };
            }

            const latestDepositTreeRoot = this.worldState.worldStateDB.getRoot(MerkleTreeId.SYNC_DEPOSIT_TREE, true).toString();
            return {
                code: 0, data: latestDepositTreeRoot, msg: ''
            };
        } catch (error) {
            console.error(error);
            await queryRunner.rollbackTransaction();

        } finally {
            await queryRunner.release();
        }

        return {
            code: 1, data: undefined, msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query deposit-tree root',
    tags: ['Rollup'],
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
