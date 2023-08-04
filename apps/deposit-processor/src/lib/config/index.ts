import {
    VerificationKey,

} from 'snarkyjs';
import { JoinSplitProof } from "@anomix/circuits"
import * as dotenv from "dotenv"
dotenv.config({ path: '../../.env' })

console.log('!process.env.TYPE_ORM_USERNAME=', process.env.TYPE_ORM_USERNAME)

const config = {
    port: <number>Number(<string>process.env.ROLLUP_SEQUENCER_PORT) || 8080,
    logger: {
        prettyPrint: <boolean>(process.env.LOGGING_PRETTY_PRINT === 'true' || true), // change if .env
        level: process.env.LOGGING_LEVEL || 'info',
    },
    typeORM: {
        type: <string>process.env.TYPE_ORM_CONNECTION || "mysql",
        host: <string>process.env.TYPE_ORM_HOST || "localhost", // "localhost" | "mysql" ~ docker,
        port: <number>Number(<string>process.env.TYPE_ORM_PORT) || 3060, // 3060 | 5432 ~ docker
        username: <string>process.env.TYPE_ORM_USERNAME || "mysql",
        password: <string>process.env.TYPE_ORM_PASSWORD || "deger",
        database: <string>process.env.TYPE_ORM_DATABASE || "unknown_db",
        //synchronize: <boolean>(process.env.TYPE_ORM_SYNCHRONIZE === "true" || true), // change if .env
        logging: <boolean>(process.env.TYPE_ORM_LOGGING === "true" || true), // change if .env
    },
    auth: {
        jwtSecret: <string>process.env.JWT_SECRET || "gtrpohgkeropk12k3k124oi23j4oifefe",
        jwtExpires: <string>process.env.JWT_EXPIRES || "1d"
    },
    helmet: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: [`'self'`],
                styleSrc: [`'self'`, `'unsafe-inline'`],
                imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
                scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
            }
        }
    },
    swagger: {
        info: {
            title: "Anomix Network - rollup-sequencer api documentation",
            version: "0.1.0"
        },
        host: <string>process.env.SWAGGER_HOST ? (<string>process.env.SWAGGER_HOST).concat(':').concat(<string>process.env.ROLLUP_SEQUENCER_PORT) : 'localhost:'.concat(<string>process.env.ROLLUP_SEQUENCER_PORT),
        schemes: ["http"],
        consumes: ["application/json"],
        produces: ["application/json"],
        securityDefinitions: {
            bearer: {
                type: "http",
                scheme: "bearer",
                name: "Authorization token",
                bearerFormat: "JWT"
            }
        }
    },
    depositProcessorHost: <string>process.env.DEPOSIT_PROCESSOR_HOST || '127.0.0.1',
    depositProcessorPort: <number>Number(<string>process.env.DEPOSIT_PROCESSOR_PORT) || 8082,
    proofGeneratorHost: <string>process.env.ROLLUP_SEQUENCER_PORT || '127.0.0.1',
    proofGeneratorPort: <number>Number(<string>process.env.ROLLUP_SEQUENCER_PORT) || 8081,
    joinsplitProofDummyTx: JoinSplitProof.fromJSON(JSON.parse(<string>process.env.JoinsplitProofDummyTx)),// TODO
    withdrawAccountVK: VerificationKey.fromJSON(<string>process.env.WithdrawAccountVK),

    depositRollup: {
        batchNum: <number>Number(<string>process.env.DEPOSIT_ROLLUP_BATCH_NUM) || 8,
    },

    sequencerPrivateKey: <string>process.env.SEQUENCER_PRIVATE_KEY,
    networkInit: <number>Number(<string>process.env.NETWORK_INIT) || 1,

    worldStateDBPath: <string>process.env.LEVELDB_WORLDSTATE_DB_PATH || '/var/leveldb/anomix_world_state_db',
    indexedDBPath: <string>process.env.LEVELDB_INDEX_DB_PATH || '/var/leveldb/anomix_index_db',

    depositWorldStateDBPath: <string>process.env.LEVELDB_DEPOSIT_STATE_DB_PATH || '/var/leveldb/anomix_deposit_rollup_state_db',
    depositIndexedDBPath: <string>process.env.LEVELDB_INDEX_DB_PATH || '/var/leveldb/anomix_deposit_index_db',

    withdrawDBPath: <string>process.env.LEVELDB_WITHDRAW_DB_PATH || '/var/leveldb/anomix_withdraw_db',

    pinoLogFilePath: <string>process.env.PINO_LOG_FILE_PATH || '/var/anomix/logs/',

    entryContractAddress: <string>process.env.ENTRY_CONTRACT_ADDRESS || 'B62785kfljj8784990kj0kj90kjjiekljk',
    rollupContractAddress: <string>process.env.ROLLUP_CONTRACT_ADDRESS || 'B62785kfljjj490kljk87j90kj90kjiekl878',

    depositEndpoint_couldStopMarkDepositActions: `http://${<string>process.env.DEPOSIT_PROCESSOR_HOST}:${<number>Number(<string>process.env.DEPOSIT_PROCESSOR_PORT)}/stop-mark`,
}

export default config
