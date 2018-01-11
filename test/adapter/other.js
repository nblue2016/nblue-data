const assert = require('assert')
const path = require('path')
const core = require('nblue-core')
const ndata = require('../../lib')

const betch = core.betch

const ConfigMap = core.ConfigMap
const Schemas = ndata.Schemas
const DbConnections = ndata.DbConnections

const timeoutValue = 2000

const envs = ['dev', 'debug', 'qa']

describe('other - init ', () => {
  let
    conns = null,
    postAdapter = null


  before((done) => {
    // parse config and schema files
    const configFile = String.format('%s/../config3.yml', __dirname)
    const schemaFile = 'blog.js'

    betch([
      ConfigMap.parseConfig(configFile, envs),
      Schemas.parse(path.join(__dirname, '../', 'schemas', schemaFile))
    ]).
      then((data) => {
        // [config, schemas] = data
        conns = new DbConnections(data[1])
        conns.createByConfigs(data[0])

        return conns.openAll()
      }).
      then(() => conns.getAdapter('post')).
      then((data) => {
        postAdapter = data

        return postAdapter.delete({})
      }).
      then(() => done()).
      catch((err) => done(err))
  })

  it('default - values and bind method', function (done) {
    this.timeout(timeoutValue)

    const post = {
      title: 'title1'
    }

    postAdapter.
      create(post).
      then((data) => {
        assert.equal(data.key, 'key1', 'post.key')
        assert.ok(!data.complexKey.key1, 'post.complexKey.key1')
        assert.equal(data.complexKey.key2, 'ckey12', 'post.complexKey.key2')
        assert.equal(data.complexKey2, 'ckey2', 'post.key')
        assert.ok(data.tags, 'post.tags')
        assert.ok(!data.content, 'post.content')
        assert.ok(data.publishedOn, 'post.publishedOn')
        assert.ok(!data.publishedBy, 'post.publishedBy')
        assert.ok(!data.email, 'post.email')

        assert.equal(
          data.getNewTitle(), `${post.title}_new`, 'post.getNewTitle()'
        )
      }).
      then(() => done()).
      catch((err) => done(err))
  })

  it('wrapper function', (done) => {
    const wrapperFunc = function () {
      return {
        to: (post) => {
          post.abstract = 'abstract-test'
          post.viewCount = 10

          return post
        },
        from: (post) => post
      }
    }

    postAdapter.getWrapper = wrapperFunc

    postAdapter.
      create({ title: 'test' }).
      then((data) => {
        assert.equal(data.abstract, 'abstract-test', 'post.abstract')
        assert.equal(data.viewCount, 10, 'post.viewCount')
      }).
      then(() => done()).
      catch((err) => done(err)).
      finally(() => {
        postAdapter.getWrapper = null
      })
  })

  after((done) => {
    conns.closeAll().
      then(() => done()).
      catch((err) => done(err))
  })
})
