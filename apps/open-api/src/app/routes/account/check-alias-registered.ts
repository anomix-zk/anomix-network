import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';

import { RequestHandler } from '@/lib/types'
import { Account, L2Tx, MemPlL2Tx } from '@anomix/dao'
import { BaseResponse, L2TxStatus } from "@anomix/types";
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('web-server');

export const checkAliasRegister: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/account/check-alias-registered",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

type ReqBody = { aliashash: string, includePending: boolean };

export const handler: RequestHandler<ReqBody, null> = async function (
    req,
    res
): Promise<BaseResponse<boolean>> {
    const { aliashash: p_aliashash, includePending } = req.body

    const connection = getConnection();
    const accountRepository = connection.getRepository(Account)
    try {
        let code = 0;// registered!
        let data = true;
        let msg = '';
        const account = await accountRepository.findOne({ where: { aliasHash: p_aliashash } });
        if (account /* && includePending */) {
            const mpL2TxRepo = connection.getRepository(MemPlL2Tx);
            const mpL2Tx = await mpL2TxRepo.findOne(account.l2TxId);
            if (!mpL2Tx) {
                const l2TxRepo = connection.getRepository(L2Tx);
                const l2Tx = await l2TxRepo.findOne(account.l2TxId);
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
            msg = 'no this alias!'
        }

        return {
            code,
            data,
            msg
        };

    } catch (err) {
        logger.info(err);

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'check if alias has been registered',
    tags: ["Account"],
    body: {
        type: "object",
        properties: {
            aliashash: {
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
