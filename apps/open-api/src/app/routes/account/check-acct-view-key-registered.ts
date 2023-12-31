// @Get('/account/acctvk/:aliashash')
/**
 * (2)供client根据account_viewing_key查询recipient的alias_nullifier
 */
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';

import { RequestHandler } from '@/lib/types'
import { Account, L2Tx, MemPlL2Tx } from '@anomix/dao'
import { BaseResponse, L2TxStatus } from "@anomix/types";
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('checkAcctViewKeyRegistered');

export const checkAcctViewKeyRegistered: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/account/check-acct-view-key-registered",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

type reqBody = { acctViewKey: string, includePending: boolean };

export const handler: RequestHandler<reqBody, null> = async function (
    req,
    res
): Promise<BaseResponse<boolean>> {
    const { acctViewKey, includePending } = req.body

    const connection = getConnection();
    const accountRepository = connection.getRepository(Account)
    try {
        let code = 0;// registered!
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
                    code = 1;// not registered!
                    data = false;
                }

            } else {
                const status = (mpL2Tx)!.status;
                if (status == L2TxStatus.FAILED) {
                    code = 1;// not registered!
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

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }

}
const schema = {
    description: 'check if acctViewKey has been registered',
    tags: ["Account"],
    body: {
        type: "object",
        properties: {
            acctViewKey: {
                type: "string",
            },
            includePending: {
                type: "boolean"
            }
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                },
                data: {
                    type: "boolean"
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
