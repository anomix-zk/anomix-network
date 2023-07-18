// @Get('/account/acctvk/:aliashash')
/**
 * (2)供client根据account_viewing_key查询recipient的alias_nullifier
 */
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';

import { RequestHandler } from '@anomix/types'
import { Account } from '@anomix/dao'

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
type Response = { data: string[] }

export const handler: RequestHandler<null, AliasHashParam> = async function (
    req,
    res
): Promise<Response> {
    const { aliashash: p_aliashash } = req.params

    const accountRepository = getConnection().getRepository(Account)
    try {
        const accountList = await accountRepository.find({ where: { aliashash: p_aliashash } });
        return {
            data: accountList.map(acct => {
                return acct.acctViewKey;
            })
        } as Response;

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }

}
const schema = {
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
            type: "object",
            properties: {
                data: {
                    type: "object",
                    properties: {
                        acctvkList: {
                            type: "array",
                            items: {
                                type: "string"
                            }
                        }
                    }
                }
            }
        }
    }
}
