import fs from "fs";
import * as dotenv from "dotenv"
import { JoinSplitProver } from "@anomix/circuits";
dotenv.config({ path: '../../.env' })

const KeyConfig = JSON.parse(fs.readFileSync('../../packages/circuits/scripts/keys-private.json', 'utf8'));

const { verificationKey: JoinSplitProverVK } = await JoinSplitProver.compile();
// const JoinSplitProverVK = ''

const config = {
    port: <number>Number(<string>process.env.PROOF_GENERATOR_PORT ?? 8081),
    portProofVerifyServer0: <number>Number(<string>process.env.PROOF_GENERATOR_PROOF_VERIFY_PORT_0 ?? 8085),
    portProofVerifyServer1: <number>Number(<string>process.env.PROOF_GENERATOR_PROOF_VERIFY_PORT_1 ?? 8086),
    portProofVerifyServer2: <number>Number(<string>process.env.PROOF_GENERATOR_PROOF_VERIFY_PORT_2 ?? 8087),

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
            title: "Anomix Network - proof-generators api documentation",
            version: "0.1.0"
        },
        host: <string>process.env.SWAGGER_HOST ? (<string>process.env.SWAGGER_HOST).concat(':').concat(<string>process.env.PROOF_GENERATOR_PORT) : 'localhost:'.concat(<string>process.env.PROOF_GENERATOR_PORT),
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

    proofGeneratorHost: <string>process.env.PROOF_GENERATOR_HOST || '127.0.0.1',
    proofGeneratorPort: <number>Number(<string>process.env.PROOF_GENERATOR_PORT ?? 8081),

    pinoLogFilePath: <string>process.env.PINO_LOG_FILE_PATH || '/var/anomix/logs/proof-generators/',

    vaultContractAddress: <string>KeyConfig.vaultContract.publicKey,
    entryContractAddress: <string>KeyConfig.entryContract.publicKey,
    rollupContractAddress: <string>KeyConfig.rollupContract.publicKey,

    subProcessCnt: <number>Number(<string>process.env.PROOR_GENERATOR_SUB_PROCESSOR_COUNT ?? 1),
    httpProtocol: <string>process.env.HTTP_PROTOCOL || 'http',

    joinSplitProverVK: JoinSplitProverVK,

    cnt_DepositRollupProver: <number>Number(<string>process.env.CNT_DepositRollupProver ?? 1),
    cnt_AnomixEntryContract: <number>Number(<string>process.env.CNT_AnomixEntryContract ?? 1),
    cnt_JoinSplitProver: <number>Number(<string>process.env.CNT_JoinSplitProver ?? 1),
    cnt_InnerRollupProver: <number>Number(<string>process.env.CNT_InnerRollupProver ?? 1),
    cnt_BlockProver: <number>Number(<string>process.env.CNT_BlockProver ?? 1),
    cnt_AnomixRollupContract: <number>Number(<string>process.env.CNT_AnomixRollupContract ?? 1),

    proxyMinaEndpoint: <string>process.env.PROXY_MINA_ENDPOINT || 'https://berkeley.graphql.minaexplorer.com/',
    graphqlArchiveEndpoint: <string>process.env.GRAPHQL_ARCHIVE_ENDPOINT || 'https://berkeley.graphql.minaexplorer.com/',

}

export default config
