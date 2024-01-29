import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { triggerSeqDepositCommitment, triggerContractCall, queryLatestDepositTreeRoot } from "./handlers/depositProcessorHandler";

const PROTO_PATH = __dirname + './protos/deposit-processor.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const depositProcessor = grpc.loadPackageDefinition(packageDefinition).depositProcessor;

function getGrpcServer() {
    const server = new grpc.Server();
    server.addService(depositProcessor.DepositProcessor.service, {
        triggerSeqDepositCommitment,
        triggerContractCall,
        queryLatestDepositTreeRoot
    });
    return server;
}
