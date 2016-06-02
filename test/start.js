require('nblue-core')

const path = require('path')
const dataLib = require('../lib')

const ConfigMap = global.ConfigMap
const SchemaCache = dataLib.SchemaCache

// parse schema files
const schemas = SchemaCache.create()
const schemaFiles = ['blog._js', 'blog.json', 'northwind.json']

schemaFiles.
  map((file) => path.join(__dirname, 'schemas', file)).
  map((file) => schemas.defineSync(file))

if (!global.schemas) global.schemas = schemas.Cache

// parse configuration file
const configFile = String.format('%s/config.yml', __dirname)
const config = ConfigMap.parseConfigSync(configFile, ['dev', 'debug', 'qa'])

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
