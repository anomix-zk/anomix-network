import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import * as apiSeqHandlerList from "./handlers/api-sequencer";

const PROTO_PATH = __dirname + './protos/api-sequencer.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const apiSeq = grpc.loadPackageDefinition(packageDefinition).rollupSeq;

function getGrpcServer() {
    const server = new grpc.Server();
    server.addService(apiSeq.ApiSequencer.service, {
        withdrawAsset: apiSeqHandlerList.withdrawAsset,
        checkPoint: apiSeqHandlerList.checkPoint,
        queryTxByNullifier: apiSeqHandlerList.queryTxByNullifier,
        queryTxByNoteHashx: apiSeqHandlerList.queryTxByNoteHashx,
        queryUserTreeInfo: apiSeqHandlerList.queryUserTreeInfo,
    });
    return server;
}
