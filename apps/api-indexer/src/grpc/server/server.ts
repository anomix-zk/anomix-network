import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import * as apiIndexerHandlerList from "./handlers/api-indexer";

const PROTO_PATH = __dirname + './protos/api-indexer.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const apiIndexer = grpc.loadPackageDefinition(packageDefinition).rollupSeq;

function getGrpcServer() {
    const server = new grpc.Server();
    server.addService(apiIndexer.ApiIndexer.service, {
        checkAcctViewKeyRegistered: apiIndexerHandlerList.checkAcctViewKeyRegistered,
        checkAliasAlignWithViewKey: apiIndexerHandlerList.checkAliasAlignWithViewKey,
        queryBlockByBlockHash: apiIndexerHandlerList.queryBlockByBlockHash,
        queryBlockByBlockHeight: apiIndexerHandlerList.queryBlockByBlockHeight,
        queryByTxHashes: apiIndexerHandlerList.queryByTxHashes,

        queryAcctViewKeyByAlias: apiIndexerHandlerList.queryAcctViewKeyByAlias,

        queryAliasByAcctViewKey: apiIndexerHandlerList.queryAliasByAcctViewKey,
        queryAssetsInBlocks: apiIndexerHandlerList.queryAssetsInBlocks,
        queryPartialByBlockHeight: apiIndexerHandlerList.queryPartialByBlockHeight,
        queryLatestBlockHeight: apiIndexerHandlerList.queryLatestBlockHeight,
        queryPendingTxs: apiIndexerHandlerList.queryPendingTxs,

        queryWithdrawalNotesx: apiIndexerHandlerList.queryWithdrawalNotesx,
    });
    return server;
}
