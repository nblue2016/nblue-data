const nblue = require('nblue')

const path = require('path')
const betch = nblue.betch

const nblueData = require('../lib')

const ConfigMap = global.ConfigMap
const Schemas = nblueData.Schemas

// define test script files
const testScripts = [
  '#./schema',
  '#./connections',
  './adapter/test',
  '#./adapter/crud',
  '#./adapter/default',
  '#./adapter/validator'
]

const files = ['blog.json', 'blog.js', 'northwind.json'].
  map(
    (file) => path.join(__dirname, 'schemas', file)
  )

const configFile = String.format('%s/config.yml', __dirname)

describe('init envirnment', () => {
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
