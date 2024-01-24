import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { queryTxByNullifierEndpoint, withdrawAssetEndpoint } from "./handlers/rollupSeqHandler";

const PROTO_PATH = __dirname + './protos/rollup-seq.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const rollupSeq = grpc.loadPackageDefinition(packageDefinition).rollupSeq;

function getGrpcServer() {
    const server = new grpc.Server();
    server.addService(rollupSeq.RollupSeq.service, {
        queryTxByNullifier: queryTxByNullifierEndpoint,
        withdrawAsset: withdrawAssetEndpoint,
    });
    return server;
}
