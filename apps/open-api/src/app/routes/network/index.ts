/*
(8)供client查询network status
    ①获取元数据，如合约地址、合约状态、innerRollup的拼接数量等
    ②--查询memory pool的pending tx的数量
    ③--最佳tx_free
*/

import { FastifyPlugin } from "fastify"
import { queryPendingTxs } from "./query-pending-txs";
import { queryTxFeeSuggestions } from "./query-txfees-suggestion";
import { queryWorldStateStatus } from "./query-worldstate-status";

export const networkEndpoint: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(queryPendingTxs);
    instance.register(queryTxFeeSuggestions);
    instance.register(queryWorldStateStatus);
}
