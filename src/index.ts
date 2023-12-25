import './dotenv.js'
const isLegacy = process.env.LEGACY === 'true'
const isStandalone = process.env.STANDALONE === 'true'

if (isLegacy) {
  console.log('isLegacy')
  import('./multiple.js')
}

if (isStandalone) {
  console.log('isStandalone')
  import('./standalone.js')
}

if (!isLegacy) {
  console.log('!isLegacy')
  import('./create-graphql-gateway.js')
}
