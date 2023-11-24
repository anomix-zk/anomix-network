import { FastifyCore } from './app'
import { activeMinaInstance } from "@anomix/utils";

const server = async () => {
    // init Mina tool
    await activeMinaInstance();// TODO improve it to configure graphyQL endpoint

    const app = new FastifyCore()

    console.log('proof-generator server is listening...');
    await app.listen()
}

export default server

server()
