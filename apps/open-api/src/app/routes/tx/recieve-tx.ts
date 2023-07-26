import { L2TxDTOSchema, L2TxDTO } from '@anomix/types'
import { getConnection } from 'typeorm';
import { FastifyPlugin } from "fastify";
import httpCodes from "@inip/http-codes";
import { MemPlL2Tx } from '@anomix/dao'
import { RequestHandler } from '@/lib/types';
import { JoinSplitProof } from "@anomix/circuits";
import config from "@/lib/config";
import { verify } from "snarkyjs";
/**
* 供client发送L2 tx
*  ① 如果是withdraw, 则返回url
*/
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
    const l2TxBody = req.body;

    // validate tx's proof
    const proof = JoinSplitProof.fromJSON(JSON.parse(l2TxBody.proof));// TODO need 'fromJSON(*)'??
    const ok = await verify(proof.toJSON(), config.joinSplitVK);

    if (!ok) {
        throw req.throwError(httpCodes.BAD_REQUEST, { data: 'verify failed!' })
    }

    // TODO need compare each fields in L2TxDTO with that within 'proof'
    // 
    //

    try {
        const memPlL2TxRepository = getConnection().getRepository(MemPlL2Tx);
        // TODO merge fields
        //
        //
        memPlL2TxRepository.save([l2TxBody], {});
        return { data: 'ok' } as Response

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    tags: ["L2Tx"],
    body: {
        type: "object",
        properties: (L2TxDTOSchema as any).properties,
        required: (L2TxDTOSchema as any).required
    },
    response: {
        200: {
            type: "object",
            properties: {
                "data": {
                    type: "string",
                }
            }
        },
        400: {
            type: "object",
            properties: {
                "data": {
                    type: "string",
                }
            }
        }
    }
}
