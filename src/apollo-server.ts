import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { ApolloServerPluginInlineTrace } from '@apollo/server/plugin/inlineTrace'
import FileUploadDataSource from './lib/index.js'
import { Express } from 'express'
import http from 'http'
import { Headers } from 'node-fetch'

type Prop = {
  app: Express
  name?: string
  port: number
  service: { name: string; url: string }[]
  httpServer: http.Server
  path: string
  enableSubcription?: boolean
}

const isIntrospection =
  process.env.INTROSPECTION === 'true' || process.env.NODE_ENV !== 'production'

export const initApolloServer = async (p: Prop) => {
  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: p.service.map(i => ({
        name: i.name,
        url: i.url,
      })),
      pollIntervalInMs: 3000,
    }),
    buildService: ({ name, url }) => {
      return new FileUploadDataSource({
        url,
        //@ts-ignore
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

  if (p.enableSubcription) {
    // TODO
    // const wsServer = new WebSocketServer({
    //   // This is the `httpServer` we created in a previous step.
    //   server: p.httpServer,
    //   // Pass a different path here if app.use
    //   // serves expressMiddleware at a different path
    //   path: p.path,
    // })
    // // eslint-disable-next-line react-hooks/rules-of-hooks
    // serverCleanup = useServer({ schema: gateway.schema }, wsServer)
  }

  const server = new ApolloServer({
    gateway: gateway,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer: p.httpServer }),
      ApolloServerPluginInlineTrace(),
    ],
    introspection: isIntrospection,
    stopOnTerminationSignals: true,
  })

  await server.start()
  const path = p.path || '/graphql'
  p.app.use(path, expressMiddleware(server, { context: async r => r }))

  console.log(
    `⚡️[server]: Service ${p.name ?? ''} is running at http://localhost:${p.port}${path} `,
  )

  return server
}
