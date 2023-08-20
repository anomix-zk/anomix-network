import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';

import { RequestHandler } from '@/lib/types'
import { Account, L2Tx, MemPlL2Tx } from '@anomix/dao'
import { BaseResponse, L2TxStatus } from "@anomix/types";

export const checkAliasAlignWithViewKey: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/account/check-alias-align-with-acct-view-key",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

type ReqBody = { aliasHash: string, acctViewKey: string };

export const handler: RequestHandler<ReqBody, null> = async function (
    req,
    res
): Promise<BaseResponse<boolean>> {
    const { aliasHash, acctViewKey } = req.body

    const connection = getConnection();
    const accountRepository = connection.getRepository(Account)
    try {
        let code = 1;
        let data = false;
        const account = await accountRepository.findOne({ where: { aliasHash } });
        if (account?.acctPk == acctViewKey) {
            code = 0;
            data = true;
        }

        return {
            code,
            data,
            msg: ''
        };

    } catch (err) {
        console.log(err);

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
