import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';

import { RequestHandler } from '@/lib/types'
import { Account, L2Tx, MemPlL2Tx } from '@anomix/dao'
import { BaseResponse, L2TxStatus } from "@anomix/types";
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('checkAliasAlignWithViewKey');
export const checkAliasAlignWithViewKey: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/account/check-alias-align-with-acct-view-key",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

type ReqBody = { aliasHash: string, acctViewKey: string, includePending: boolean };

export const handler: RequestHandler<ReqBody, null> = async function (
    req,
    res
): Promise<BaseResponse<boolean>> {
    const { aliasHash, acctViewKey, includePending } = req.body

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
                        code = 1;// not registered!
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

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'check if alias has been registered with acct-viewing-key',
    tags: ["Account"],
    body: {
        type: "object",
        properties: {
            aliasHash: {
                type: "string",
            },
            acctViewKey: {
                type: "string"
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
