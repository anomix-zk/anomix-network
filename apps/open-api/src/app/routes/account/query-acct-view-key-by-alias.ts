// @Get('/account/acctvk/:aliashash')
/**
 * (2)供client根据account_viewing_key查询recipient的alias_nullifier
 */
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';

import { RequestHandler } from '@/lib/types'
import { Account } from '@anomix/dao'
import { BaseResponse } from "@anomix/types";
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('web-server');
export const queryAcctViewKeyByAlias: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/account/acctvk/:aliashash",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

type AliasHashParam = { aliashash: string }

export const handler: RequestHandler<null, AliasHashParam> = async function (
    req,
    res
): Promise<BaseResponse<string[]>> {
    const { aliashash: p_aliashash } = req.params

    const accountRepository = getConnection().getRepository(Account)
    try {
        const accountList = await accountRepository.find({ where: { aliasHash: p_aliashash } }) ?? [];
        if (accountList.length > 0) {
            return {
                code: 0,
                data: accountList.map(acct => {
                    return acct.acctPk;
                }),
                msg: ''
            };
        }

        return {
            code: 0,
            data: undefined,
            msg: ''
        };

    } catch (err) {
        logger.error(err);

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }

}
const schema = {
    description: 'query acct-view-key by aliashash',
    tags: ["Account"],
    params: {
        type: "object",
        properties: {
            aliashash: {
                type: "string",
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
                    type: "array",
                    items: {
                        type: 'string'
                    }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
