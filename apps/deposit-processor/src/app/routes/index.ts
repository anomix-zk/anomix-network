import { FastifyPlugin } from "fastify"
import { health } from '../plugins'
import { merkleProofEndpoint } from "./merkleproof";
import { proofCallback } from "./proof-callback";

export const routes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.register(health)
    instance.register(merkleProofEndpoint)
    instance.register(proofCallback)
}
