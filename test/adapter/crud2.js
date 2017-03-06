// const assert = require('assert')
const path = require('path')
const core = require('nblue-core')
const ndata = require('../../lib')

const aq = core.aq
const co = core.co
const betch = core.betch

const ConfigMap = core.ConfigMap
const Schemas = ndata.Schemas
const DbConnections = ndata.DbConnections

const envs = ['dev', 'debug', 'qa']

let
  config = null,
  schemas = null

describe('adapter - open/close', () => {
  before((done) => {
    // parse config and schema files
    const configFile = String.format('%s/../config3.yml', __dirname)
    const schemaFiles = ['blog.json', 'northwind.json', 'blog.js']

    betch([
      ConfigMap.parseConfig(configFile, envs),
      Schemas.parse(
        schemaFiles.map((file) => path.join(__dirname, '../', 'schemas', file))
      )
    ]).
    then((data) => {
      [config, schemas] = data
    }).
    then(() => done()).
    catch((err) => done(err))
  })

  it('ok', () => null)

  it('test', function (done) {
    this.timeout(5000)

    const conns = new DbConnections(schemas)

    conns.createByConfigs(config)

    co(function *() {
      // open all database
      const conn = conns.getConnectionByModel('user')
      const schema = conns.Schemas.Schema('user')

      yield conn.open()

      try {
        const adapter = yield conn.getAdapter(schema)

        const userData = JSON.parse(
          yield aq.readFile(path.join(__dirname, 'users.json'), 'utf-8')
        )

        yield adapter.create(userData)
      } finally {
        yield conn.close()
      }

      yield conn.open()

      try {
        const adapter = yield conn.getAdapter(schema)

        const userData = JSON.parse(
          yield aq.readFile(path.join(__dirname, 'users.json'), 'utf-8')
        )

        yield adapter.create(userData)
      } finally {
        yield conn.close()
      }

      yield conn.open()

      try {
        const adapter = yield conn.getAdapter(schema)

        const userData = JSON.parse(
          yield aq.readFile(path.join(__dirname, 'users.json'), 'utf-8')
        )

        yield adapter.create(userData)
      } finally {
        yield conn.close()
      }
    }).
    then(() => done()).
    catch((err) => done(err))
  })
})
