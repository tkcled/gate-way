import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { ApolloServerPluginInlineTrace } from '@apollo/server/plugin/inlineTrace'
import FileUploadDataSource from '@lib'
import type { Express } from 'express'
import type http from 'http'

type Prop = {
  app: Express
  port: number
  service: { name: string; url: string }[]
  httpServer: http.Server
  path: string
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
        willSendRequest: ({ request, context }) => {
          // if (!request.http) {
          //   // eslint-disable-next-line no-param-reassign
          //   request.http = {
          // from apollo-server-env
          //     headers: new Headers(),
          //     method: 'POST',
          //     url: '',
          //   }
          // }

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

  const server = new ApolloServer({
    gateway: gateway,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer: p.httpServer }),
      ApolloServerPluginInlineTrace(),
    ],
    introspection: isIntrospection,
    stopOnTerminationSignals: true,
    // csrfPrevention: true,
  })
  await server.start()
  const path = p.path || 'graphql'
  p.app.use(path, expressMiddleware(server, { context: async r => r }))

  console.log(`⚡️[server]: Service is running at http://localhost:${p.port}/${path} `)

  return server
}
