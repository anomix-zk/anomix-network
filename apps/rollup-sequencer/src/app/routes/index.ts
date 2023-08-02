import { FastifyPlugin } from "fastify"
import { health } from '../plugins'
import { merkleproofEndpoint } from "./merkleproof";

export const routes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.register(health)
    instance.register(merkleproofEndpoint)
}
