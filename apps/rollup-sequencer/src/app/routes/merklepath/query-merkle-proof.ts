
import httpCodes from "@inip/http-codes"
import { FastifyPlugin } from "fastify"
import MerklePathDTOSchema from "@/types/MerklePathDTO-schema.json";
import MerkleProofReqParamSchema from "@/types/MerkleProofReqParam-schema.json";
import { RequestHandler, MerklePathDTO, MerkleProofReqParam } from '@/types'

/**
 * if nullifier_tree, then find out the target leaf or its predecessor;
 * if data_tree, then find out the target leaf;
 */
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

export const handler: RequestHandler<null, MerkleProofReqParam> = async function (
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
    tags: ["MerkleProof"],
    params: {
        type: MerkleProofReqParamSchema.type,
        properties: MerkleProofReqParamSchema.properties,
        require: MerkleProofReqParamSchema.required
    },
    response: {
        200: {
            type: MerklePathDTOSchema.type,
            properties: MerklePathDTOSchema.properties,
        }
    }
}
