
import { L2Tx } from '@anomix/dao'

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { L2TxDTO, L2TxDTOSchema } from '@anomix/types'
import { RequestHandler } from '@/lib/types'

/**
* 根据alias_nullifier/account_viewing_key/valueNote_commitment/nullifier查询L2Tx
*/
export const queryTxByNoteHash: FastifyPlugin = async function (
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

type NotesReqBody = {
    notehashes: string[]
}

export const handler: RequestHandler<NotesReqBody, null> = async function (
    req,
    res
): Promise<L2TxDTO[]> {
    const { notehashes: hash } = req.body

    // TODO will improve the code by building a new KV db[nodehash -> L2tx].

    // const txRepository = getConnection().getRepository(L2Tx)
    try {
        // let txList = await txRepository.find({ where: { output_note_commitment_C: hash } });
        // if ((txList?.length == 0) || (txList ?? true)) {
        //     txList = await txRepository.find({ where: { output_note_commitment_D: hash } });
        // }
        // if ((txList?.length == 0) || (txList ?? true)) {
        //     txList = await txRepository.find({ where: { input_note_nullifier_A: hash } });
        // }
        // if ((txList?.length == 0) || (txList ?? true)) {
        //     txList = await txRepository.find({ where: { input_note_nullifier_B: hash } });
        // }
        // return (txList ?? []) as L2TxDTO[];
        return []
    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    tags: ["L2Tx"],
    params: {
        type: "object",
        properties: {
            'notehashes': {
                "type": "array",
                "items": {
                    "type": "string"
                }
            }
        },
        required: ['hash']
    },
    response: {
        200: {
            type: "object",
            "properties": {
                "data": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "note": {
                                "type": "string"
                            },
                            "txHash": {
                                "type": "string"
                            },
                        }
                    }
                }
            }
        }
    }
}
