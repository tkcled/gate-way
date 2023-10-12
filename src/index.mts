import './dotenv.mts'
const isLegacy = process.env.LEGACY === 'true'

if (isLegacy) {
  import('./multiple.mts')
}

if (!isLegacy) {
  import('./standalone.mts')
}
