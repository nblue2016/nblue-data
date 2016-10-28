// const assert = require('assert')
const path = require('path')
const nblue = require('nblue')
const ndata = require('../../lib')

const aq = nblue.aq
const co = aq.co
const betch = nblue.betch

const ConfigMap = nblue.ConfigMap
const Schemas = ndata.Schemas
const DbConnections = ndata.DbConnections

const envs = ['dev', 'debug', 'qa']

describe('Create Adapter', () => {
  let
    config = null,
    schemas = null

  before((done) => {
    // parse config and schema files
    const configFile = String.format('%s/../config.yml', __dirname)
    const schemaFile = path.join(__dirname, '../', 'schemas', 'blog.js')
    const ctx = {}

    betch({
      config: ConfigMap.parseConfig(configFile, envs),
      schemas: Schemas.parse(schemaFile)
    }, ctx).
    then(() => {
      [config, schemas] = [ctx.config, ctx.schemas]

      done()
    }).
    catch((err) => done(err))
  })
  const ary = [0, 1]
  const proxies = [ndata.MongoDbProxy, ndata.MongooseProxy]

  ary.forEach((index) => {
    const proxyName = index === 0 ? 'MongoDb' : 'Mongoose'

    it(`create adpater with betch (${proxyName})`, function (done) {
      this.timeout(5000)

      const ctx = {}
      const conns = new DbConnections(schemas)

      conns.createByConfigs(config)
      conns.registerProxy('mongodb:', proxies[index])

      betch({
        _open: conns.open('conn1'),
        adapter: conns.getAdapter('conn1', 'post'),
        post: (ctx$) => ctx$.adapter.create({ title: 'test1' }),
        _del: (ctx$) => ctx$.adapter.delete({ _id: ctx$.post._id }),
        _end: conns.close('conn1')
      }, ctx).
      then((data) => done()).
      catch((err) => done(err))
    })

    it(`create adpater with co (${proxyName})`, function (done) {
      this.timeout(5000)

      const conns = new DbConnections(schemas)

      conns.createByConfigs(config)
      conns.registerProxy('mongodb:', proxies[index])

      co(function *() {
        yield conns.open('conn1')

        const adapter = yield conns.getAdapter('conn1', 'post')

        const post = yield adapter.create({
          title: 'test',
          key: 'test key'
        })

        yield adapter.delete({ _id: post._id })

        return conns.close('conn1')
      }).
        then(() => done()).
        catch((err) => done(err))
    })
  })
})
