import { FastifyPlugin } from "fastify"
import { health } from '../plugins'
import { networkEndpoint } from "./network";
import { txEndpoint } from "./tx";

export const routes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.register(health)
    instance.register(networkEndpoint)
    instance.register(txEndpoint)
}
