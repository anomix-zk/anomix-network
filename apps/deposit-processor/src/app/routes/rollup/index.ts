
import { FastifyPlugin } from "fastify"
import { triggerSeqDepositCommitment } from "./trigger-seq-commitment";
import { queryLatestDepositTreeRoot } from "./query-latest-deposit-tree-root";
import { triggerContractCall } from "./trigger-rollup-contract-call";

export const txEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryLatestDepositTreeRoot);
    instance.register(triggerSeqDepositCommitment);
    instance.register(triggerContractCall);
}
