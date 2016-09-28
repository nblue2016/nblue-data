require('nblue')

const path = require('path')
const dataLib = require('../lib')

const ConfigMap = global.ConfigMap
const Schemas = dataLib.Schemas

// parse schema files
const schemas = Schemas.create()
const schemaFiles = ['blog.json', 'blog.js', 'northwind.json']
// const schemaFiles = ['blog.js', 'blog.json']

schemaFiles.
  map((file) => path.join(__dirname, 'schemas', file)).
  map((file) => schemas.readFileSync(file))

if (!global.schemas) global.schemas = schemas.Cache

// parse configuration file
const configFile = String.format('%s/config.yml', __dirname)
const config = ConfigMap.parseConfigSync(configFile, ['dev', 'debug', 'qa'])

if (!global.config) global.config = config

// define test script files
const testScripts = [
  './connections',
  './schema',
  './adapter/crud',
  './adapter/default',
  './adapter/validator'
]

// start to test
for (const script of testScripts) {
  if (script.startsWith('#')) continue

  require(script)
}
