import { IndexDB } from "@/worldstate"
import { ProofScheduler } from "@/rollup/proof-scheduler"
import { WorldState } from "@/worldstate"
import { FastifyReply } from "fastify"
import { WithdrawDB } from "@/worldstate/withdraw-db"


declare module 'fastify' {

    interface FastifyInstance {
        authGuard(request: FastifyRequest, reply: FastifyReply): void
        adminGuard(request: FastifyRequest, reply: FastifyReply): void
        worldState: WorldState,
        withdrawDB: WithdrawDB,
        proofScheduler: ProofScheduler,
        notification: { atRollup: boolean }
    }

    interface FastifyRequest {
        throwError<T = unknown>(statusCode: number, message: T, thrownError?: Error): void
    }

}
