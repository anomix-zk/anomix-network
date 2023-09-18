import { FastifyPlugin } from "fastify"
import { merkleProofEndpoint } from "./merkleproof";
import { proofCallback } from "./proof-callback";
import { rollupProofTrigger } from "./rollup-proof-trigger";
import { rollupSeqTrigger } from "./rollup-seq-trigger";
import { notesEndpoint } from "./note";
import { txEndpoint } from "./tx";
import { networkEndpoints } from "./network";

export const routes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.register(merkleProofEndpoint)
    instance.register(proofCallback)
    instance.register(rollupProofTrigger)
    instance.register(rollupSeqTrigger)
    instance.register(notesEndpoint)
    instance.register(txEndpoint)
    instance.register(networkEndpoints);
}
