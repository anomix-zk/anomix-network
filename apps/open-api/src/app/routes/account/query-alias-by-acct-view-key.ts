// @Get('/account/alias/:acctvk')
/**
 * (1)供client根据alias_nullifier查询recipient的account_viewing_key
 */
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';

import { RequestHandler } from '@/lib/types'
import { Account } from '@anomix/dao'
import { BaseResponse } from "@anomix/types";
import { getLogger } from "@/lib/logUtils";

const logger = getLogger('queryAliasByAcctViewKey');

export const queryAliasByAcctViewKey: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/account/alias/:acctvk",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

type AcctvkParam = { acctvk: string }

export const handler: RequestHandler<null, AcctvkParam> = async function (
    req,
    res
): Promise<BaseResponse<{ alias: string, aliasInfo: string }>> {
    const { acctvk: p_acctvk } = req.params
    const accountRepository = getConnection().getRepository(Account)
    try {
        const account = await accountRepository.findOne({ where: { acctPk: p_acctvk } });
        if (account) {
            return {
                code: 0, data: {
                    alias: account?.aliasHash,
                    aliasInfo: account?.encrptedAlias
                }, msg: ''
            }
        }
        return {
            code: 0, data: undefined, msg: ''
        }
    } catch (err) {
        logger.error(err);

        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query aliashash by acct-view-key',
    tags: ["Account"],
    params: {
        type: "object",
        properties: {
            acctvk: {
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
                    type: "object",
                    properties: {
                        alias: {
                            type: "string",
                        },
                        aliasInfo: {
                            type: "string",
                        }
                    }
                },
                msg: {
                    type: 'string'
                }
            }
        }
    }
}
