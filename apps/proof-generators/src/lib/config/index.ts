import * as dotenv from "dotenv"
dotenv.config({ path: '../../.env' })

const config = {
    port: <number>Number(<string>process.env.PROOF_GENERATOR_PORT ?? 8081),
    logger: {
        prettyPrint: <boolean>(process.env.LOGGING_PRETTY_PRINT === 'true' || true), // change if .env
        level: process.env.LOGGING_LEVEL || 'info',
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
    depositProcessorPort: <number>Number(<string>process.env.DEPOSIT_PROCESSOR_PORT ?? 8082),

    sequencerProcessorHost: <string>process.env.ROLLUP_SEQUENCER_HOST || '127.0.0.1',
    sequencerProcessorPort: <number>Number(<string>process.env.ROLLUP_SEQUENCER_PORT ?? 8080),

    pinoLogFilePath: <string>process.env.PINO_LOG_FILE_PATH || '/var/anomix/logs/proof-generators/',

    entryContractAddress: <string>process.env.ENTRY_CONTRACT_ADDRESS || 'B62785kfljj8784990kj0kj90kjjiekljk',
    rollupContractAddress: <string>process.env.ROLLUP_CONTRACT_ADDRESS || 'B62785kfljjj490kljk87j90kj90kjiekl878',

    subProcessCnt: <number>Number(<string>process.env.PROOR_GENERATOR_SUB_PROCESSOR_COUNT ?? 1),
}

export default config
