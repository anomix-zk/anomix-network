import { FastifyCore } from './app'
import { initORM } from './lib/orm'

const server = async () => {
    // init leveldb

    await initORM()
    const app = new FastifyCore()
    await app.listen()

    // Highlevel Processing Progress:
    // start pipeline: new instance would be set by last one in 10mins when last one ends.
    // read pipelineTxCount = InnerRollupTxCount * OuterRollupInnerBatchesCount
    // Query mysqlDB: 
    // if pendingTxs is equal/greater than pipelineTxCount,
    // * if there are pending tx on 'deposit', then should rank first,
    // * if there are pending tx on 'account', then should rank second,
    // * filter the x TXes whose tx_fee ranks x.
    // else 
    // * query all pendingTxes and compose PaddingTxes to fill.

    // Begin maintain WorldState:
    // * compose CommonUserTxWrapper for each tx within each batch,
    // * save each batch to MysqlDB,
    // * send signal to start 'proof-generator',
    //   * 'proof-generator' server query them for inner merge,
}

export default server

server()
