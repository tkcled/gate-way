import './dotenv'
const isLegacy = process.env.LEGACY === 'true'

if (isLegacy) {
  require('./multiple')
}

if (!isLegacy) {
  require('./standalone')
}
