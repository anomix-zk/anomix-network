import { IndexDB } from "@/rollup"
import { WorldStateDB } from "@/worldstate"
import { WithdrawDB } from "@/worldstate/withdraw-db"
import { FastifyReply } from "fastify"


declare module 'fastify' {

    interface FastifyInstance {
        authGuard(request: FastifyRequest, reply: FastifyReply): void
        adminGuard(request: FastifyRequest, reply: FastifyReply): void
        worldStateDB: WorldStateDB,
        withdrawDB: WithdrawDB,
        indexDB: IndexDB,
        notification: { atRollup: boolean }
    }

    interface FastifyRequest {
        throwError<T = unknown>(statusCode: number, message: T, thrownError?: Error): void
    }

}
