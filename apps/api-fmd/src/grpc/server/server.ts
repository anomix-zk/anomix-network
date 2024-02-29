import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import * as apiSeqHandlerList from "./handlers/api-fmd";

const PROTO_PATH = __dirname + './protos/api-fmd.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const apiFmd = grpc.loadPackageDefinition(packageDefinition).apiFmd;

function getGrpcServer() {
    const server = new grpc.Server();
    server.addService(apiFmd.ApiFmd.service, {
        queryByTxFmd: apiSeqHandlerList.queryByTxFmd,
    });
    return server;
}
