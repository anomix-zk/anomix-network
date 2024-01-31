import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import config from "@/lib/config";
const PROTO_PATH = __dirname + '../../../../rollup-sequencer/src/grpc/server/protos/rollup-seq.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const rollupSeq = grpc.loadPackageDefinition(packageDefinition).rollupSeq;

export const client = new rollupSeq.RollupSeq(config.httpProtocol + config.sequencerProcessorHost + ':' + config.sequencerProcessorPort,
    grpc.credentials.createInsecure());
