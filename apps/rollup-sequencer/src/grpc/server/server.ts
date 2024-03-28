import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import * as rollupSeqHandlerList from "./handlers/rollupSeqHandler";

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
        queryTxByNullifier: rollupSeqHandlerList.queryTxByNullifier,
        withdrawAsset: rollupSeqHandlerList.withdrawAsset,
        checkPoint: rollupSeqHandlerList.checkPoint,
        proofCallback: rollupSeqHandlerList.proofCallback,
        rollupProofTrigger: rollupSeqHandlerList.rollupProofTrigger,
        triggerStartNewFlow: rollupSeqHandlerList.triggerStartNewFlow,
        checkCommitmentsExist: rollupSeqHandlerList.checkCommitmentsExist,
        checkDataRootsExist: rollupSeqHandlerList.checkDataRootsExist,
        checkNullifiersExist: rollupSeqHandlerList.checkNullifiersExist,
        syncUserWithdrawedNotes: rollupSeqHandlerList.syncUserWithdrawedNotes,
        queryWorldStateworldState: rollupSeqHandlerList.queryWorldStateworldState,
        queryNetworkMetaData: rollupSeqHandlerList.queryNetworkMetaData,
        appendTreeByHand: rollupSeqHandlerList.appendTreeByHand,
        appendUserNullifierTreeByHand: rollupSeqHandlerList.appendUserNullifierTreeByHand,
        queryMerkleProof: rollupSeqHandlerList.queryMerkleProof
    });
    return server;
}

