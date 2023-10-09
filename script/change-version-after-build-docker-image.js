const fs = require('fs')
const packageJson = require('../version.json')

function getNewVersion() {
  return process.argv[2]
}

packageJson.version = getNewVersion()

fs.writeFile('./version.json', JSON.stringify(packageJson, null, 2), err => {
  if (err) {
    console.error(err)
    return
  }
  console.log('File has been created')
})
