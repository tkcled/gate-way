import './dotenv.js'
const isLegacy = process.env.LEGACY === 'true'

if (isLegacy) {
  import('./multiple.js')
}

if (!isLegacy) {
  import('./standalone.js')
}
