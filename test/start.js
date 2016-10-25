const nblue = require('nblue')

const path = require('path')
const betch = nblue.betch

const nblueData = require('../lib')

const ConfigMap = global.ConfigMap
const Schemas = nblueData.Schemas

// define test script files
const testScripts = [
  './connections',
  './schema',
  '#./adapter/crud',
  '#./adapter/default',
  '#./adapter/validator'
]

const files = ['blog.json', 'blog.js', 'northwind.json'].
  map(
    (file) => path.join(__dirname, 'schemas', file)
  )

const configFile = String.format('%s/config.yml', __dirname)

describe('Init envirnment', () => {
  before('', (done) => {
    const ctx = {}

    betch({
      cf: ConfigMap.parseConfigSync(
            configFile,
            ['dev', 'debug', 'qa']
          ),
      sc: Schemas.parse(files)
    }, ctx).
    then(() => {
      global.config = ctx.cf
      global.schemas = ctx.sc.Cache

      done()
    }).
    catch((err) => done(err))
  })

  it('', () => {
    for (const script of testScripts) {
      if (script.startsWith('#')) continue

      require(script)
    }
  })
})

/*
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
*/
