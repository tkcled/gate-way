import './dotenv.mjs'
const isLegacy = process.env.LEGACY === 'true'

if (isLegacy) {
  import('./multiple.mjs')
}

if (!isLegacy) {
  import('./standalone.mjs')
}
