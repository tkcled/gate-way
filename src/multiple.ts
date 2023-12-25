import express, { Express } from 'express'
import morgan from 'morgan'
import helmet from 'helmet'
import cors from 'cors'
import bodyParser from 'body-parser'
import { ApolloServer } from '@apollo/server'
import http from 'http'
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { ApolloServerPluginInlineTrace } from '@apollo/server/plugin/inlineTrace'
import { expressMiddleware } from '@apollo/server/express4'
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs'
import FileUploadDataSource from './lib/FileUploadDataSource.js'
import { Headers } from 'node-fetch'
import requestIp from 'request-ip'

morgan.token('graphql-query', req => {
  // @ts-ignore
  const { query, variables, operationName } = req.body
  if (operationName === 'IntrospectionQuery') {
    return
  }
  // eslint-disable-next-line consistent-return
  return `GRAPHQL: \nOperation Name: ${operationName} \nQuery: ${query} \nVariables: ${JSON.stringify(
    variables,
  )}`
})

const isIntrospection =
  process.env.INTROSPECTION === 'true' || process.env.NODE_ENV !== 'production'

const main = async () => {
  const app = express()
  const port = process.env.PORT
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(graphqlUploadExpress())
  app.use(morgan(':graphql-query'))
  app.use(requestIp.mw())

  const envKeys = Object.keys(process.env)

  const adminService = envKeys.filter(i => i.startsWith('ADMIN_SERVICE_') && process.env[i])

  const coreService = envKeys.filter(i => i.startsWith('SERVICE_') && process.env[i])

  if (process.env.ENABLE_CORS === 'true') {
    app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'] }))
  }

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
        return new FileUploadDataSource({
          url,
          willSendRequest: ({ request, context }) => {
            if (!request.http) {
              request.http = {
                headers: new Headers(),
                method: 'POST',
                url: '',
              }
            }

            if (context.req?.headers) {
              // eslint-disable-next-line no-restricted-syntax
              for (const [headerKey, headerValue] of Object.entries(context.req.headers)) {
                if (headerKey !== 'content-type' && headerKey !== 'content-length') {
                  if (headerKey && headerValue) {
                    // @ts-ignore
                    request.http?.headers.set(headerKey, headerValue)
                  }
                }
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

    app.use('/graphql/core', expressMiddleware(adminServer, { context: async r => r }))

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
        return new FileUploadDataSource({
          url,
          willSendRequest: ({ request, context }) => {
            if (!request.http) {
              request.http = {
                headers: new Headers(),
                method: 'POST',
                url: '',
              }
            }

            if (context.req?.headers) {
              request.http.headers.set('x-client-ip-custom', context.req.clientIp)
              // eslint-disable-next-line no-restricted-syntax
              for (const [headerKey, headerValue] of Object.entries(context.req.headers)) {
                if (headerKey !== 'content-type' && headerKey !== 'content-length') {
                  if (headerKey && headerValue) {
                    // @ts-ignore
                    request.http?.headers.set(headerKey, headerValue)
                  }
                }
              }
            }
          },
        })
      },
    })

    const adminServer = new ApolloServer({
      gateway: adminGateway,
      plugins: [ApolloServerPluginDrainHttpServer({ httpServer }), ApolloServerPluginInlineTrace()],
      introspection: isIntrospection,
      stopOnTerminationSignals: true,
      // csrfPrevention: true,
    })
    await adminServer.start()

    app.use(
      '/graphql/admin',
      // graphqlUploadExpress(),
      expressMiddleware(adminServer, { context: async r => r }),
    )

    app.use(helmet())
    console.log(`⚡️[server]: Admin Service is running at http://localhost:${port}/graphql/admin `)
  }

  httpServer.listen({ port }, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port} `)
  })
}

main()
