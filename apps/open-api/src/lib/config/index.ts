import {
    VerificationKey,
} from 'o1js';
import fs from "fs";
import * as dotenv from "dotenv"
import { JoinSplitProver } from '@anomix/circuits';

dotenv.config({ path: '../../.env' })

// const JoinSplitProverVK: string = fs.readFileSync('./circuit-JoinSplitProverVK.string', 'utf8');
const { verificationKey: JoinSplitProverVK } = await JoinSplitProver.compile();
// const JoinSplitProverVK = ''
const config = {
    port: <number>Number(<string>process.env.OPENAPI_PORT) || 80,
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
            title: "Anomix Network - openAPI api documentation",
            version: "0.1.0"
        },
        host: ((<string>process.env.SWAGGER_HOST) ?? 'localhost') == 'localhost' ? 'localhost'.concat(':').concat(<string>process.env.OPENAPI_PORT) : (<string>process.env.SWAGGER_HOST),
        schemes: [<string>process.env.SWAGGER_SCHEME ?? 'http'],
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
    pinoLogFilePath: <string>process.env.PINO_LOG_FILE_PATH || '/var/anomix/logs/',
    joinSplitProverVK: JoinSplitProverVK,
    txFeeFloor: <number>Number(<string>process.env.TxFeeFloor) || 1000 * 1000, // default 0.001Mina
    sequencerHost: <string>process.env.ROLLUP_SEQUENCER_HOST || '127.0.0.1',
    sequencerPort: <number>Number(<string>process.env.ROLLUP_SEQUENCER_PORT) || 8080,
    coordinatorHost: <string>process.env.COORDINATOR_HOST || '127.0.0.1',
    coordinatorPort: <number>Number(<string>process.env.COORDINATOR_PORT) || 8083,

    maxMpTxCnt: <number>Number(<string>process.env.MAX_MP_TX_CNT) || 300,

    // L2Tx Fee suggestion
    minMpTxFeeToGenBlock: <number>Number(<string>process.env.MIN_MP_TX_FEE_TO_GEN_BLOCK) || 0.09 * 1000_000_000,
    floorMpTxFee: <number>Number(<string>process.env.FLOOR_MP_TX_FEE) || 0.03 * 1000_000_000,
    httpProtocol: <string>process.env.HTTP_PROTOCOL || 'http'

}

export default config
