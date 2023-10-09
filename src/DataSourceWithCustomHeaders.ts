import { GraphQLDataSourceProcessOptions } from '@apollo/gateway'
// import { Headers } from 'apollo-server-env'
import FileUploadDataSource from './lib/FileUploadDataSource'
// import { FetcherHeaders } from '@apollo/utils.fetcher'
// import { Headers } from '@lib/header'
// import FileUploadDataSource from '@profusion/apollo-federation-upload'

class DataSourceWithCustomHeaders extends FileUploadDataSource {
  // eslint-disable-next-line class-methods-use-this
  willSendRequest(options: GraphQLDataSourceProcessOptions): void {
    if (!options.request.http) {
      // eslint-disable-next-line no-param-reassign
      // options.request.http = {
      //   headers: new Headers(),
      //   method: 'POST',
      //   url: '',
      // }
    }
    options.request.http?.headers.set('accept-language', 'pt-BR')
  }
}

export default DataSourceWithCustomHeaders
