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
    joinsplitProofDummyTx: ({} as any) as JoinSplitProof,// TODO
    innerRollup: {
        txCount: <number>Number(<string>process.env.InnerRollupTxCount) || 2,
    },
    outRollup: {
        innerBatchesCount: <number>Number(<string>process.env.OuterRollupInnerBatchesCount) || 12,
    },
    sequencerPrivateKey: <string>process.env.SEQUENCER_PRIVATE_KEY,

}

export default config