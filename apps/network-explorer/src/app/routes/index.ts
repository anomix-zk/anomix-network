import { FastifyPlugin } from "fastify"
import { health } from '../plugins'
import { accountEndpoint } from "./account";
import { blockEndpoint } from "./block";
import { merkleproofEndpoint } from "./merkleproof";
import { networkEndpoint } from "./network";
import { noteEndpoint } from "./note";
import { txEndpoint } from "./tx";

export const routes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.register(health)
    instance.register(accountEndpoint)
    instance.register(blockEndpoint)
    instance.register(merkleproofEndpoint)
    instance.register(networkEndpoint)
    instance.register(noteEndpoint)
    instance.register(txEndpoint)
}
