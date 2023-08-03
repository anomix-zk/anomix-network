import { FastifyPlugin } from "fastify"
import { queryMerkleProof } from "./query-merkle-proof";
export const merkleProofEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryMerkleProof);
}
