const fs = require('fs')
const path = require('path')
const core = require('nblue-core')

const testScripts = [
  './connections',
  '#./schema'
]

/*
if (ConfigMap && !ConfigMap.parseConfig) {

  ConfigMap.parseConfig = function (cfile) {
    const readConfig = (cfile, ext) => {

      if (!ext) ext = '.yml'

      try {
        fs.statSync(cfile)

        // read data from configuration file
        const data = fs.readFileSync(cfile, { encoding: 'utf-8' })

        if (ext === '.json' || ext === '.config') {
          return ConfigMap.parseJSON(data)
        }
        else {
          return ConfigMap.parseYAML(data)
        }
      }
      catch(err) {
        return null
      }
    }

    fpath = path.parse(cfile)

    const cfileDebug = String.format("%s/%s.debug%s", fpath['dir'], fpath['name'], fpath['ext'])
    const cfileRelease = String.format("%s/%s.release%s", fpath['dir'], fpath['name'], fpath['ext'])

    const config = readConfig(cfile, fpath['ext'])
    const configDebug = readConfig(cfileDebug, fpath['ext'])
    const configRelease = readConfig(cfileRelease, fpath['ext'])

    if (config && configDebug) config.merge(configDebug)
    if (config && configRelease) config.merge(configRelease)

    console.log(config)

    return config
  }
}
*/


const config = ConfigMap.parseConfig(String.format("%s/config.yml", __dirname))

console.log(config)

if (!global.config) global.config = config

for (let script of testScripts) {
  if (script.startsWith('#')) continue

  require(script)
}
