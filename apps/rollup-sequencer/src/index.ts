import { FastifyCore } from './app'
// import { initORM } from './lib/orm'

const server = async () => {
    // await initORM()
    const app = new FastifyCore()
    await app.listen()


    // startup pipeline

}

export default server

server()
