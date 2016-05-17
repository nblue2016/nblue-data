const core = require('nblue-core')

const testScripts = [
  './connections',
  '#./schema'
]

const config = ConfigMap.parseConfig(String.format("%s/config.yml", __dirname))

if (!global.config) global.config = config

for (let script of testScripts) {
  if (script.startsWith('#')) continue

  require(script)
}
