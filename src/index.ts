import express, { Express } from 'express'
import dotenv from 'dotenv'
import morgan from 'morgan'
import helmet from 'helmet'
import cors from 'cors'
import bodyParser from 'body-parser'
import { ApolloServer } from '@apollo/server'
import http from 'http'
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { expressMiddleware } from '@apollo/server/express4'

morgan.token('graphql-query', req => {
  // @ts-ignore
  const { query, variables, operationName } = req.body
  return `GRAPHQL: \nOperation Name: ${operationName} \nQuery: ${query} \nVariables: ${JSON.stringify(
    variables,
  )}`
})

dotenv.config()

const isIntrospection =
  process.env.INTROSPECTION === 'true' || process.env.NODE_ENV !== 'production'

const main = async () => {
  const app: Express = express()
  const port = process.env.PORT
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  // app.use(morgan(':graphql-query'))

  const envKeys = Object.keys(process.env)

  const adminService = envKeys.filter(i => i.startsWith('ADMIN_SERVICE_') && process.env[i])

  const coreService = envKeys.filter(i => i.startsWith('SERVICE_') && process.env[i])

  app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'] }))

  const httpServer = http.createServer(app)

  if (coreService.length) {
    const coreGateway = new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: coreService.map(i => ({
          name: i,
          url: process.env[i],
        })),
        pollIntervalInMs: 3000,
      }),
      buildService: ({ name, url }) => {
        return new RemoteGraphQLDataSource({
          url,
          willSendRequest: ({ request, context }) => {
            if (context.req?.headers) {
              // eslint-disable-next-line no-restricted-syntax
              for (const [headerKey, headerValue] of Object.entries(context.req.headers)) {
                // @ts-ignore
                if (headerKey && headerValue) request.http?.headers.set(headerKey, headerValue)
              }
            }
          },
        })
      },
    })

    const adminServer = new ApolloServer({
      gateway: coreGateway,
      plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
      introspection: isIntrospection,
      stopOnTerminationSignals: true,
    })
    await adminServer.start()

    app.use('/graphql/core', expressMiddleware(adminServer))

    console.log(`⚡️[server]: Core Service is running at http://localhost:${port}/graphql/core `)
  }

  if (adminService.length) {
    const adminGateway = new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: adminService.map(i => ({
          name: i,
          url: process.env[i],
        })),
        pollIntervalInMs: 3000,
      }),
      buildService: ({ name, url }) => {
        return new RemoteGraphQLDataSource({
          url,
          willSendRequest: ({ request, context }) => {
            if (context.req?.headers) {
              // eslint-disable-next-line no-restricted-syntax
              for (const [headerKey, headerValue] of Object.entries(context.req.headers)) {
                // @ts-ignore
                if (headerKey && headerValue) request.http?.headers.set(headerKey, headerValue)
              }
            }
          },
        })
      },
    })

    const adminServer = new ApolloServer({
      gateway: adminGateway,
      plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
      introspection: isIntrospection,
      stopOnTerminationSignals: true,
    })
    await adminServer.start()

    app.use('/graphql/admin', expressMiddleware(adminServer, { context: async r => r }))

    app.use(helmet())
    console.log(`⚡️[server]: Admin Service is running at http://localhost:${port}/graphql/admin `)
  }

  httpServer.listen({ port }, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port} `)
  })
}

main()
