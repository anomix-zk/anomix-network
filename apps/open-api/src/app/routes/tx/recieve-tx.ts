import { RequestHandler } from '@anomix/types'
import { L2TxDTO } from '@anomix/types'
import { getConnection } from 'typeorm';
import { FastifyPlugin } from "fastify";
import httpCodes from "@inip/http-codes";
import { L2Tx } from '@anomix/dao'
import L2TxDTOSchema from '@anomix/types';
import { BaseSiblingPath } from "@anomix/merkle-tree";

/**
* 供client发送L2 tx
*  ① 如果是withdraw, 则返回url
*/
// @Controller("tx")


export const recieveTx: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx",
        schema,
        handler
    })
}

type Response = { data: string }

export const handler: RequestHandler<L2TxDTO, null> = async function (req, res): Promise<Response> {
    const l2TxRepository = getConnection().getRepository(L2Tx);

    const l2TxBody = req.body;

    // validate tx's proof

    try {
        l2TxRepository.save([l2TxBody], {});
        return { data: 'ok' } as Response

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    tags: ["L2Tx"],
    body: {
        "type": (L2TxDTOSchema as any).type,
        "properties": (L2TxDTOSchema as any).properties,
        "required": (L2TxDTOSchema as any).required
    },
    response: {
        200: {
            type: "object",
            "properties": {
                "data": {
                    type: "string",
                }
            }
        },
    }
}
