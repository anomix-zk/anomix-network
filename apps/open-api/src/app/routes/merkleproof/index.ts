/**
(4)供client查询merkle path
    ①alias_nullifier 存在性证明 和 不存在性证明
    ②account_viewing_key_nullifier 存在性证明 和 不存在性证明
    ③nullifierA/nullifierB 不存在性证明
    ④commitmentC/commitmentD 存在性证明
*/
import { FastifyPlugin } from "fastify"
import { queryMerkleProof } from "./query-merkle-proof";
import { queryWitnessByWithdrawNotes } from "./query-witness-by-withdraw-notes";

export const merkleproofEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryMerkleProof);
    instance.register(queryWitnessByWithdrawNotes);
}
