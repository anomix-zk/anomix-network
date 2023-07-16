/**
 * if nullifier_tree, then find out the target leaf or its predecessor;
 * if data_tree, then find out the target leaf;
 */
// @Get('/merklepath/:tree_name/:hash')

import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import { getConnection } from 'typeorm';
import MerklePathDTOSchema from "@/types/MerklePathDTO-schema.json";

import { RequestHandler, MerklePathDTO } from '@/types'

export const queryMerkleProof: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.route({
        method: "GET",
        url: "/merklepath/:tree_name/:hash",
        //preHandler: [instance.authGuard],
        schema,
        handler
    })
}

type ReqParam = { tree_name: string, hash: string }

export const handler: RequestHandler<null, ReqParam> = async function (
    req,
    res
): Promise<MerklePathDTO> {
    const { tree_name, hash } = req.params

    try {
        /**
         * TODO 
         */

        return {} as MerklePathDTO;

    } catch (err) {
        throw req.throwError(httpCodes.INTERNAL_SERVER_ERROR, "Internal server error")
    }
}

const schema = {
    tags: ["L2Tx"],
    params: {
        type: "object",
        properties: {
            id: {
                type: "string",
            }
        }
    },
    response: {
        200: {
            "type": MerklePathDTOSchema.type,
            "properties": MerklePathDTOSchema.properties,
        }
    }
}
