require('nblue-core')

const path = require('path')
const dataLib = require('../lib')

const ConfigMap = global.ConfigMap
const SchemaCache = dataLib.SchemaCache

// parse schema files
const cache = SchemaCache.create()

const files = ['blog._js', 'blog.json', 'northwind.json']

files.
  map((file) => path.join(__dirname, 'schemas', file)).
  map((file) => cache.add(file))

// only get schema of entities for mongo-db
const schemas = cache.getSchemas('mongo')

if (!global.schemas) global.schemas = schemas

// parse configuration file
const configFile = String.format('%s/config.yml', __dirname)
const config = ConfigMap.
  parseConfigSync(configFile, ['dev', 'debug'])

if (!global.config) global.config = config

// define test script files
const testScripts = [
  './connections',
  './schema',
  './adapter'
]

// start to test
for (const script of testScripts) {
  if (script.startsWith('#')) continue

  require(script)
}
