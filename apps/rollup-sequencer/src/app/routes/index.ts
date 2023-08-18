import { FastifyPlugin } from "fastify"
import { health } from '../plugins'
import { merkleProofEndpoint } from "./merkleproof";
import { proofCallback } from "./proof-callback";
import { rollupProofTrigger } from "./rollup-proof-trigger";
import { rollupSeqTrigger } from "./rollup-seq-trigger";

export const routes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.register(health)
    instance.register(merkleProofEndpoint)
    instance.register(proofCallback)
    instance.register(rollupProofTrigger)
    instance.register(rollupSeqTrigger)
}
