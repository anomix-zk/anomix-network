import messages from "./protos/proofGenerator_pb";
import services from "./protos/proofGenerator_grpc_pb";
import grpc from "grpc";
import config from "../../lib/config";
function proofGenReq(call, callback) {

    var reply = new messages.HelloReply();

    reply.setMsg('Hello ' + call.request.getName());

    callback(null, reply);
}

// 我们先来看下main函数
function main() {
    var server = new grpc.Server(); // 创建grpc server对象

    server.addService(services.HelloYeahService, {
        proofGenReq: proofGenReq,
        proofVerifyReq: proofVerifyReq,
        joinsplitProofVerifyReq: joinsplitProofVerifyReq
    });

    server.bind(`0.0.0.0:${config.port}`, grpc.ServerCredentials.createInsecure());
    // 启动服务
    server.start();
}
