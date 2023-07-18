import { FastifyPlugin } from "fastify"
import { health } from '../plugins'

import { user } from './user'
import { tx } from "./tx";

export const routes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.register(health)
    instance.register(user, { prefix: "/user" })
    instance.register(tx)
}
