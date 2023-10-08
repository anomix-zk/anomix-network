
// ---- require auth ----
// '/reset-pipeline'
// '/restart-pipeline'
// '/runtime-config': 修改配置

import { FastifyPlugin } from "fastify"
import { changeInput } from "./change-input";
import { resetNetwork } from './reset-network'

export const managerEndpoints: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    // instance.register(resetNetwork);
}
