import bodyParser from 'body-parser'
import cors from 'cors'
import express, { Express } from 'express'
import morgan from 'morgan'
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs'
import helmet from 'helmet'

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

export const getExpressApp = () => {
  const app: Express = express()
  const port = process.env.PORT
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(graphqlUploadExpress())
  app.use(morgan(':graphql-query'))

  if (process.env.ENABLE_CORS === 'true') {
    app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'] }))
  }

  return app
}

export const useHelmet = (app: Express) => {
  app.use(helmet())
}
