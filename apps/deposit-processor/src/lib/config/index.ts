import * as dotenv from "dotenv"
import fs from "fs";

const KeyConfig = JSON.parse(fs.readFileSync('../../packages/circuits/scripts/keys-private.json', 'utf8'));

dotenv.config({ path: '../../.env' })

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
    proofGeneratorHost: <string>process.env.PROOF_GENERATOR_HOST || '127.0.0.1',
    proofGeneratorPort: <number>Number(<string>process.env.PROOF_GENERATOR_PORT ?? 8081),

    depositRollup: {
        batchNum: <number>Number(<string>process.env.DEPOSIT_ROLLUP_BATCH_NUM ?? 8),
    },

    l1TxFee: <number>Number(<string>process.env.L1_TX_FEE ?? 200_000_000),

    depositWorldStateDBPath: <string>process.env.LEVELDB_DEPOSIT_ROLLUP_STATE_DB_PATH || './anomix_deposit_rollup_state_db',
    depositIndexedDBPath: <string>process.env.LEVELDB_DEPOSIT_INDEX_DB_PATH || './anomix_deposit_index_db',

    pinoLogFilePath: <string>process.env.PINO_LOG_FILE_PATH || '/var/anomix/logs/',

    txFeePayerPrivateKey: <string>KeyConfig.feePayer.privateKey,
    operatorPrivateKey: <string>KeyConfig.operator.privateKey,
    vaultContractAddress: <string>KeyConfig.vaultContract.publicKey,
    entryContractAddress: <string>KeyConfig.entryContract.publicKey,
    rollupContractAddress: <string>KeyConfig.rollupContract.publicKey,

    entryContractDeploymentBlockHeight: <number>Number(<string>process.env.ENTRY_CONTRACT_ADDRESS_DEPLOYMENT_BLOCKHEIGHT ?? 0),
    rollupContractDeploymentBlockHeight: <number>Number(<string>process.env.ROLLUP_CONTRACT_ADDRESS_DEPLOYMENT_BLOCKHEIGHT ?? 0),

    coordinatorHost: <string>process.env.COORDINATOR_HOST || '127.0.0.1',
    coordinatorPort: <number>Number(<string>process.env.COORDINATOR_PORT ?? 8083),

    httpProtocol: <string>process.env.HTTP_PROTOCOL || 'http'

}

export default config
