/*
(8)供client查询network status
    ①获取元数据，如合约地址、合约状态、innerRollup的拼接数量等
    ②获取指定(范围的)block
    ③查询memory pool的pending tx的数量
    ④最佳tx_free
*/
import { FastifyPlugin } from "fastify"
import { isNetworkReady } from './sequencer-status';
import { queryWorldStateworldState } from './query-worldstate-state'

export const networkEndpoints: FastifyPlugin = async (
    instance,
    options,
    done
): Promise<void> => {
    instance.register(isNetworkReady);
    instance.register(queryWorldStateworldState);
}
