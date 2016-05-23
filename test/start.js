require('nblue-core')
const ConfigMap = global.ConfigMap

const testScripts = [
  './connections',
  './schema'
]

const config = ConfigMap.
  parseConfigSync(String.format('%s/config.yml', __dirname))

if (!global.config) global.config = config

for (const script of testScripts) {
  if (script.startsWith('#')) continue

  require(script)
}
