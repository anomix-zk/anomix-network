
import { FastifyPlugin } from "fastify"
import { triggerSeqDepositCommitment } from "./trigger-seq-commitment";
import { queryLatestDepositTreeRoot } from "./query-latest-deposit-tree-root";

export const txEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryLatestDepositTreeRoot);
    instance.register(triggerSeqDepositCommitment);
}
