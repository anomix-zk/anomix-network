import { IndexDB } from "@/rollup"
import { WorldState, WorldStateDB } from "@/worldstate"
import { FastifyReply } from "fastify"


declare module 'fastify' {

    interface FastifyInstance {
        authGuard(request: FastifyRequest, reply: FastifyReply): void
        adminGuard(request: FastifyRequest, reply: FastifyReply): void
        WorldState: WorldState,
        worldStateDB: WorldStateDB,
        indexDB: IndexDB,
    }

    interface FastifyRequest {
        throwError<T = unknown>(statusCode: number, message: T, thrownError?: Error): void
    }

}
