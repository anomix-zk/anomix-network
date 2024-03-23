

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { BaseResponse, L2TxRespDto } from '@anomix/types'
import { RequestHandler } from '@/lib/types'
import { getConnection, In } from "typeorm"
import { L2Tx } from "@anomix/dao"

/**
* query L2tx by note_commitment
*/
export const queryTxByNoteHashes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "POST",
        url: "/tx/notehashes",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

export const handler: RequestHandler<string[], null> = async function (
    req,
    res
): Promise<BaseResponse<L2Tx[]>> {
    const notehashes = req.body;

    const connection = getConnection();

    try {
        // query confirmed tx
        const txRepository = connection.getRepository(L2Tx);
        let l2TxListNoteCommitment1 = await txRepository.find({
            where: {
                outputNoteCommitment1: In(notehashes)
            }
        }) ?? [];

        let l2TxListNoteCommitment2 = await txRepository.find({
            where: {
                outputNoteCommitment2: In(notehashes)
            }
        }) ?? [];

        let l2TxList = l2TxListNoteCommitment1.concat(l2TxListNoteCommitment2);
        const map = new Map();
        l2TxList.forEach(e => {
            map.set(e.txHash, e);
        });

        const result = Array.from(map.values());

        return {
            code: 0,
            data: result,
            msg: ''
        };
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    description: 'query tx list by note hash list',
    tags: ["L2Tx"],
    body: {
        type: "array",
        items: {
            type: "string"
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
                        type: "object",
                        properties: {
                            note: {
                                type: "string"
                            },
                            txHash: {
                                type: "string"
                            },
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
