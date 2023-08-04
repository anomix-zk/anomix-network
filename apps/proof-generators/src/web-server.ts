import { FastifyCore } from './app'
import { activeMinaInstance } from "@anomix/utils";

const server = async () => {
    // init Mina tool
    await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

    const app = new FastifyCore()

    await app.listen()
}

export default server

server()
