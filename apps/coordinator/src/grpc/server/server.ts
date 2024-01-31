import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { highFeeTxExist, proofNotify } from "./handlers/coordinatorHandler";

const PROTO_PATH = __dirname + './protos/coordinator.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const coordinator = grpc.loadPackageDefinition(packageDefinition).coordinator;

function getGrpcServer() {
    const server = new grpc.Server();
    server.addService(coordinator.Coordinator.service, {
        highFeeTxExist,
        proofNotify,
    });
    return server;
}
