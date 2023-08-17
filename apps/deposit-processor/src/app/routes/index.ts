import { FastifyPlugin } from "fastify"
import { health } from '../plugins'
import { proofCallback } from "./proof-callback";
import { jointSplitActions } from "./action-to-join-split";

export const routes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.register(health)
    instance.register(jointSplitActions);
    instance.register(proofCallback)
}
