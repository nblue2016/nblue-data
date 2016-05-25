require('nblue-core')

const path = require('path')
const dataLib = require('../lib')

const ConfigMap = global.ConfigMap
const SchemaCache = dataLib.SchemaCache

const cache = SchemaCache.create()

const files = ['blog._js', 'blog.json', 'northwind.json']

files.
  map((file) => path.join(__dirname, 'schemas', file)).
  map((file) => cache.add(file))

const schemas = cache.getSchemas('mongo')

const testScripts = [
  './connections',
  './schema',
  './adapter'
]

const configFile = String.format('%s/config.yml', __dirname)
const config = ConfigMap.
  parseConfigSync(configFile, ['dev', 'debug'])

if (!global.config) global.config = config
if (!global.schemas) global.schemas = schemas

for (const script of testScripts) {
  if (script.startsWith('#')) continue

  require(script)
}
