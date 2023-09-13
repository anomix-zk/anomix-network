import { FastifyPlugin } from "fastify"
import { health } from '../plugins'
import { txEndpoint } from "./rollup";
import { proofCallback } from "./proof-callback";
import { actionToJoinSplitDeposit } from "./action-to-join-split";
import { merkleProofEndpoint } from "./merkleproof";

export const routes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.register(health)
    instance.register(actionToJoinSplitDeposit);
    instance.register(proofCallback);
    instance.register(txEndpoint);
    instance.register(merkleProofEndpoint);
}
