import { GraphQLDataSourceProcessOptions, RemoteGraphQLDataSource } from '@apollo/gateway'
import Upload, { FileUpload } from 'graphql-upload/Upload.mjs'
import { isObject } from '@apollo/gateway/dist/utilities/predicates.js'
// @ts-ignore
import cloneDeep from 'lodash.clonedeep'
// @ts-ignore
import set from 'lodash.set'
import { FetchInterface, FetchOptions } from 'make-fetch-happen'

import fetcher from 'make-fetch-happen'
import FormData from './FormData.js'

type FileVariablesTuple = [string, Promise<FileUpload>]

type Variables = Record<string, unknown> | null

type ConstructorArgs = Exclude<ConstructorParameters<typeof RemoteGraphQLDataSource>[0], undefined>

type Response = Awaited<ReturnType<FetchInterface>>

type ProcessResult = ReturnType<RemoteGraphQLDataSource['process']>

export type FileUploadDataSourceArgs = Omit<ConstructorArgs, 'fetcher'> & {
  useChunkedTransfer?: boolean
}

type AddDataHandler = (form: FormData, resolvedFiles: FileUpload[]) => Promise<void | void[]>

const addChunkedDataToForm: AddDataHandler = (
  form: FormData,
  resolvedFiles: FileUpload[],
): Promise<void> => {
  resolvedFiles.forEach(({ createReadStream, filename, mimetype: contentType }, i: number) => {
    form.append(i.toString(), createReadStream(), {
      contentType,
      filename,
      /*
          Set knownLength to NaN so node-fetch does not set the
          Content-Length header and properly set the enconding
          to chunked.
          https://github.com/form-data/form-data/pull/397#issuecomment-471976669
        */
      knownLength: Number.NaN,
    })
  })
  return Promise.resolve()
}

const addDataToForm: AddDataHandler = (
  form: FormData,
  resolvedFiles: FileUpload[],
): Promise<void[]> =>
  Promise.all(
    resolvedFiles.map(
      async ({ createReadStream, filename, mimetype: contentType }, i: number): Promise<void> => {
        const fileData = await new Promise<Buffer>((resolve, reject) => {
          const stream = createReadStream()
          const buffers: Buffer[] = []
          stream.on('error', reject)
          stream.on('data', (data: Buffer) => {
            buffers.push(data)
          })
          stream.on('end', () => {
            resolve(Buffer.concat(buffers))
          })
        })
        form.append(i.toString(), fileData, {
          contentType,
          filename,
          knownLength: fileData.length,
        })
      },
    ),
  )

export default class FileUploadDataSource extends RemoteGraphQLDataSource {
  //@ts-ignore
  fetcher: FetchInterface

  private static extractFileVariables(rootVariables?: Variables): FileVariablesTuple[] {
    const extract = (variables?: Variables, prefix?: string): FileVariablesTuple[] => {
      return Object.entries(variables || {}).reduce(
        (acc: FileVariablesTuple[], [name, value]): FileVariablesTuple[] => {
          const p = prefix ? `${prefix}.` : ''
          const key = `${p}${name}`
          if (value instanceof Promise || value instanceof Upload) {
            acc.push([key, value instanceof Upload ? (value as Upload).promise : value])
            return acc
          }
          if (Array.isArray(value)) {
            const [first] = value
            if (first instanceof Promise || first instanceof Upload) {
              return acc.concat(
                value.map(
                  (v: Promise<FileUpload> | Upload, idx: number): FileVariablesTuple => [
                    `${key}.${idx}`,
                    v instanceof Upload ? v.promise : v,
                  ],
                ),
              )
            }
            if (isObject(first)) {
              return acc.concat(
                ...value.map((v: Variables, idx: number): FileVariablesTuple[] =>
                  extract(v, `${key}.${idx}`),
                ),
              )
            }
            return acc
          }
          if (isObject(value)) {
            return acc.concat(extract(value as Variables, key))
          }
          return acc
        },
        [],
      )
    }
    return extract(rootVariables)
  }

  private addDataHandler: AddDataHandler

  constructor(config?: FileUploadDataSourceArgs) {
    super(config)
    const useChunkedTransfer = config?.useChunkedTransfer ?? true
    this.addDataHandler = useChunkedTransfer ? addChunkedDataToForm : addDataToForm
    //@ts-ignore
    this.fetcher = fetcher.defaults({
      // Allow an arbitrary number of sockets per subgraph. This is the default
      // behavior of Node's http.Agent as well as the npm package agentkeepalive
      // which wraps it, but is not the default behavior of make-fetch-happen
      // which wraps agentkeepalive (that package sets this to 15 by default).
      maxSockets: Infinity,
      // although this is the default, we want to take extra care and be very
      // explicity to ensure that mutations cannot be retried. please leave this
      // intact.
      retry: false,
    })
  }

  async process(args: GraphQLDataSourceProcessOptions): ProcessResult {
    const fileVariables = FileUploadDataSource.extractFileVariables(args.request.variables)

    if (fileVariables.length > 0) {
      return this.processFiles(args, fileVariables)
    }
    return super.process(args)
  }

  private async processFiles(
    args: GraphQLDataSourceProcessOptions,
    fileVariables: FileVariablesTuple[],
  ): ProcessResult {
    const { context, request } = args
    const form = new FormData()

    const variables = cloneDeep(request.variables || {})
    fileVariables.forEach(([variableName]: FileVariablesTuple): void => {
      set(variables, variableName, null)
    })

    const operations = JSON.stringify({
      query: request.query,
      variables,
    })

    form.append('operations', operations)

    const fileMap: { [key: string]: string[] } = {}

    const resolvedFiles: FileUpload[] = await Promise.all(
      fileVariables.map(
        async ([variableName, file]: FileVariablesTuple, i: number): Promise<FileUpload> => {
          const fileUpload: FileUpload = await file
          fileMap[i] = [`variables.${variableName}`]
          return fileUpload
        },
      ),
    )

    // This must come before the file contents append bellow
    form.append('map', JSON.stringify(fileMap))
    await this.addDataHandler(form, resolvedFiles)

    // This must happen before constructing the request headers
    // otherwise any custom headers set in willSendRequest are ignored
    if (this.willSendRequest) {
      await this.willSendRequest(args)
    }

    const headers = {
      ...Object.fromEntries(request?.http?.headers || []),
      ...form.getHeaders(),
    }

    Object.assign(headers, form.getHeaders() || {})

    const httpRequest = {
      headers,
      method: 'POST',
      url: this.url,
    }

    const options = {
      ...httpRequest,
      body: form,
    }

    request.http = httpRequest as Exclude<typeof request.http, undefined>

    let httpResponse: Response | undefined

    try {
      //@ts-ignore
      httpResponse = await this.fetcher(this.url, options)

      const body = await this.parseBody(httpResponse)

      if (!isObject(body)) {
        throw new Error(`Expected JSON response body, but received: ${body}`)
      }
      const response = {
        //@ts-ignore
        ...body,
        http: httpResponse,
      }

      if (typeof this.didReceiveResponse === 'function') {
        return this.didReceiveResponse({ context, request, response })
      }

      return response
    } catch (error) {
      //@ts-ignore
      this.didEncounterError(error, options, httpResponse)
      throw error
    }
  }

  // eslint-disable-next-line class-methods-use-this
  //@ts-ignore
  public override didEncounterError(
    error: unknown,
    _request: FetchOptions,
    _reponse?: Response,
  ): never {
    throw error
  }
}
