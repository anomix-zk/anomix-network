import fs from "fs";
import * as dotenv from "dotenv"
import { JoinSplitProof } from "@anomix/circuits"

dotenv.config({ path: '../../.env' })

const JoinsplitProofDummyTx: string = fs.readFileSync('./JoinsplitProofDummyTx.string', 'utf8');

const config = {
    port: <number>Number(<string>process.env.DEPOSIT_PROCESSOR_PORT) || 8082,
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
        host: ((<string>process.env.SWAGGER_HOST) ?? 'localhost').concat(':').concat(<string>process.env.DEPOSIT_PROCESSOR_PORT),
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
    depositProcessorPort: <number>Number(<string>process.env.DEPOSIT_PROCESSOR_PORT ?? 8082),
    proofGeneratorHost: <string>process.env.ROLLUP_SEQUENCER_HOST || '127.0.0.1',
    proofGeneratorPort: <number>Number(<string>process.env.ROLLUP_SEQUENCER_PORT ?? 8081),

    depositRollup: {
        batchNum: <number>Number(<string>process.env.DEPOSIT_ROLLUP_BATCH_NUM ?? 8),
    },

    joinsplitProofDummyTx: JoinSplitProof.fromJSON(JSON.parse(<string>process.env.JoinsplitProofDummyTx ?? JoinsplitProofDummyTx)),// TODO

    txFeePayerPrivateKey: <string>process.env.L1_TX_FEE_PAYER_PRIVATE_KEY,
    sequencerPrivateKey: <string>process.env.SEQUENCER_PRIVATE_KEY,

    depositWorldStateDBPath: <string>process.env.LEVELDB_DEPOSIT_ROLLUP_STATE_DB_PATH || './anomix_deposit_rollup_state_db',
    depositIndexedDBPath: <string>process.env.LEVELDB_DEPOSIT_INDEX_DB_PATH || './anomix_deposit_index_db',

    pinoLogFilePath: <string>process.env.PINO_LOG_FILE_PATH || '/var/anomix/logs/',

    entryContractAddress: <string>process.env.ENTRY_CONTRACT_ADDRESS || 'B62785kfljj8784990kj0kj90kjjiekljk',
    rollupContractAddress: <string>process.env.ROLLUP_CONTRACT_ADDRESS || 'B62785kfljjj490kljk87j90kj90kjiekl878',

    entryContractDeploymentBlockHeight: <number>Number(<string>process.env.ENTRY_CONTRACT_ADDRESS_DEPLOYMENT_BLOCKHEIGHT ?? 0),
    rollupContractDeploymentBlockHeight: <number>Number(<string>process.env.ROLLUP_CONTRACT_ADDRESS_DEPLOYMENT_BLOCKHEIGHT ?? 0),

    coordinatorHost: <string>process.env.COORDINATOR_HOST || '127.0.0.1',
    coordinatorPort: <number>Number(<string>process.env.COORDINATOR_PORT ?? 8083),

    httpProtocol: <string>process.env.HTTP_PROTOCOL || 'http'

}

export default config
