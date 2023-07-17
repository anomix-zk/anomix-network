
import { L2Tx } from "@/lib/orm/entity/l2_tx";

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import { RequestHandler, L2TxDTO, L2TxDTOSchema } from '@anomix/types'

/**
* 根据alias_nullifier/account_viewing_key/valueNote_commitment/nullifier查询L2Tx
*/

export const queryTxByNoteHash: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "tx/notehash/:hash",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

type NotesReqParam = {
    hash: string
}

export const handler: RequestHandler<null, NotesReqParam> = async function (
    req,
    res
): Promise<L2TxDTO[]> {
    const { hash } = req.params

    const txRepository = getConnection().getRepository(L2Tx)
    try {
        let txList = await txRepository.find({ where: { output_note_commitment_C: hash } });
        if ((txList?.length == 0) || (txList ?? true)) {
            txList = await txRepository.find({ where: { output_note_commitment_D: hash } });
        }
        if ((txList?.length == 0) || (txList ?? true)) {
            txList = await txRepository.find({ where: { input_note_nullifier_A: hash } });
        }
        if ((txList?.length == 0) || (txList ?? true)) {
            txList = await txRepository.find({ where: { input_note_nullifier_B: hash } });
        }
        return (txList ?? []) as L2TxDTO[];

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    tags: ["L2Tx"],
    params: {
        type: "object",
        properties: {
            'hash': {
                type: "string",
            }
        },
        required: ['hash']
    },
    response: {
        200: {
            "type": L2TxDTOSchema.type,
            "properties": L2TxDTOSchema.properties,
        }
    }
}
