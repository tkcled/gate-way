export const ENV = {
  get PORT() {
    return Number(process.env.PORT || 3000)
  },

  get INTROSPECTION() {
    return Boolean(process.env.INTROSPECTION)
  },

  get ENABLE_CORS() {
    return Boolean(process.env.ENABLE_CORS)
  },

  get paths() {
    return process.env.SUPPORT_PATH?.split(',') ?? []
  },

  getServiceUrlForPath: (path: string) => {
    const envKeys = Object.keys(process.env)
    const service = envKeys
      .filter(i => i.startsWith(path.toUpperCase() + '_SERVICE_') && process.env[i])
      .map(i => ({
        name: i,
        url: process.env[i] ?? '',
      }))

    return service
  },

  get services() {
    const paths = this.paths
    return paths?.map(i => ({
      path: i,
      services: this.getServiceUrlForPath(i),
      enableSubcription: Boolean(process.env[`ENABLE_SUBCRIPTION_${i.toUpperCase()}`]),
    }))
  },
}
