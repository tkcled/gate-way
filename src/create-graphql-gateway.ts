/* eslint-disable @typescript-eslint/no-unnecessary-type-constraint */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { initApolloServer } from './apollo-server.js'
import { ENV } from './env.js'
import { getExpressApp, useHelmet } from './expess.js'
import http from 'http'

export const promiseReduce: <T extends any, R extends any>(
  prev: T[],
  callback: (v: T) => Promise<R>,
) => Promise<R[]> = async (prev, callback) => {
  return prev.reduce(
    async (a, b) => {
      const result = await a
      const r = await callback(b)
      if (r) {
        result.push(r)
      }
      return Promise.resolve(result)
    },
    Promise.resolve([] as any[]),
  )
}

const main = async () => {
  const services = ENV.services
  const port = ENV.PORT
  const app = getExpressApp()
  const httpServer = http.createServer(app)

  await promiseReduce(services, async service => {
    const server = await initApolloServer({
      name: service.path,
      port,
      path: '/graphql/' + service.path,
      app,
      httpServer,
      service: service.services,
      enableSubcription: service.enableSubcription,
    })
  })

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useHelmet(app)

  httpServer.listen({ port }, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port} `)
  })
}

main()
