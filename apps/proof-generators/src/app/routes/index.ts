import { FastifyPlugin } from "fastify"
import { health } from '../plugins'
import { proofGenReqEndpoint } from "./proof-gen-req";
import { joinsplitProofVerifyEndpoint } from "./joinsplit-proof-verify";
import { proofVerifyEndpoint } from "./proof-verify";
export const routes: FastifyPlugin = async function (
    instance,
    options,
    done
): Promise<void> {
    instance.register(health)
    instance.register(proofGenReqEndpoint)

    instance.register(proofVerifyEndpoint);
    instance.register(joinsplitProofVerifyEndpoint);
}
