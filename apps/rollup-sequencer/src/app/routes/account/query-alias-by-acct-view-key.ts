// @Get('/account/alias/:acctvk')
/**
 * (1)供client根据alias_nullifier查询recipient的account_viewing_key
 */
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';

import { RequestHandler } from '@/types'
import { User } from '../../../lib/orm/entity';
import { Account } from "@/lib/orm/entity/account";

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
type Response = { data: string }

export const handler: RequestHandler<null, AcctvkParam> = async function (
    req,
    res
): Promise<Response> {
    const { acctvk: p_acctvk } = req.params

    const accountRepository = getConnection().getRepository(Account)
    try {
        const account = await accountRepository.findOne({ where: { acctViewKey: p_acctvk } });
        return { data: (account?.aliasHash) ?? '' }
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
                    type: "string"
                }
            },
        }
    }
}
