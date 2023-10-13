import { initApolloServer } from './apollo-server.js'
import { getExpressApp } from './expess.js'
import http from 'http'

const port = Number(process.env.PORT || 3000)

const main = async () => {
  const envKeys = Object.keys(process.env)
  const service = envKeys.filter(i => i.startsWith('SERVICE_') && process.env[i])

  const app = getExpressApp()
  const httpServer = http.createServer(app)

  const server = await initApolloServer({
    port,
    path: '/graphql',
    app,
    httpServer,
    service: service.map(i => ({
      name: i,
      url: process.env[i] ?? '',
    })),
  })

  httpServer.listen({ port }, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port} `)
  })
}

main()
