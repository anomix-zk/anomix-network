import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { proofGenReqEndpoint, proofVerifyEndpoint, joinsplitProofVerifyEndpoint } from "./handlers/proofGeneratorHandler";

const PROTO_PATH = __dirname + './protos/proof-gen.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const proofGenerator = grpc.loadPackageDefinition(packageDefinition).proofGenerator;

function getGrpcServer() {
    const server = new grpc.Server();
    server.addService(proofGenerator.ProofGenerator.service, {
        proofGenReq: proofGenReqEndpoint,
        proofVerifyReq: proofVerifyEndpoint,
        joinsplitProofVerifyReq: joinsplitProofVerifyEndpoint
    });
    return server;
}
