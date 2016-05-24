require('nblue-core')

const ConfigMap = global.ConfigMap

const testScripts = [
  './connections',
  './schema'
]

const configFile = String.format('%s/config.yml', __dirname)
const config = ConfigMap.
  parseConfigSync(configFile, ['dev', 'debug'])

if (!global.config) global.config = config

for (const script of testScripts) {
  if (script.startsWith('#')) continue

  require(script)
}
