const assert = require('assert')
const path = require('path')
const core = require('nblue-core')
const ndata = require('../../lib')

const aq = core.aq
const betch = core.betch

const ConfigMap = core.ConfigMap
const Schemas = ndata.Schemas
const DbConnections = ndata.DbConnections

const timeoutValue = 2000

const envs = ['dev', 'debug', 'qa']

describe('orm - init ', () => {
  let
    conns = null,
    postAdapter = null


  before((done) => {
    // parse config and schema files
    const configFile = String.format('%s/../config2.yml', __dirname)
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

  it('ok', () => null)

  it('adapter - create single', function (done) {
    this.timeout(timeoutValue)

    const post = {
      title: 'test title',
      key: 'test key'
    }

    postAdapter.
      create(post).
      then((data) => {
        assert.equal(data.title, post.title, 'post.title')
        assert.equal(data.key, post.key, 'post.key')
        assert.deepEqual(
          data.complexKey, { key2: 'ckey12' }, 'post.complexKey'
        )
        assert.ok(data.publishedOn, 'post.publishedOn')
        assert.ok(!data.publishedBy, 'post.publishedBy')

        return data
      }).
      then((data) => {
        const obj = data.toObject()
        const keys = Object.keys(obj)

        assert.equal(keys.length, 17, 'keys of object')

        return data
      }).
      then((data) => {
        data.title = 'title2'

        return data.save()
      }).
      then((data) => {
        assert.equal(data.title, 'title2', 'post.title')
      }).
      then(() => done()).
      catch((err) => done(err))
  })

  it('adapter - create many', function (done) {
    this.timeout(timeoutValue)

    const posts = [{ title: 'title1' }, { title: 'title2' }]

    postAdapter.
      create(posts).
      then((data) => {
        assert.equal(data.length, 2, 'length of created')
        assert.equal(data[0].title, 'title1', 'the 1st title')
        assert.equal(data[1].title, 'title2', 'the 2nd title')

        data[0].title = 'title1a'
        data[1].title = 'title2a'

        return aq.parallel(data.map((item) => item.save()))
      }).
      then((data) => {
        assert.equal(data.length, 2, 'length of created again')
        assert.equal(data[0].title, 'title1a', 'the 1st title again')
        assert.equal(data[1].title, 'title2a', 'the 2nd title again')
      }).
      then(() => done()).
      catch((err) => done(err))
  })

  it('adapter - retrieve', function (done) {
    this.timeout(timeoutValue)

    const filter = { title: 'title1' }
    const options = {
      limit: 5,
      sort: 'publishedOn'
    }

    postAdapter.
      retrieve(filter, options).
      then((data) => {
        data.forEach((item) => {
          assert.equal(item.title, 'title1', 'check item title')
        })
      }).
      then(() => done()).
      catch((err) => done(err))
  })

  it('adapter - count', function (done) {
    this.timeout(timeoutValue)

    const posts = [
      { title: 'test data' },
      { title: 'test data' },
      { title: 'test data' },
      { title: 'test data' },
      { title: 'test data' }
    ]
    const filter = { title: 'test data' }

    postAdapter.
      delete({}).
      then((data) => {
        assert.equal(data.ok, 1, 'correct result')
        assert.equal(data.n, 3, 'remove old data')
      }).
      then(() => postAdapter.create(posts)).
      then(() => postAdapter.count(filter)).
      then((data) => {
        assert.equal(data, 5, 'count of matched posts')
      }).
      then(() => done()).
      catch((err) => done(err))
  })

  it('adapter - update', function (done) {
    this.timeout(timeoutValue)

    const filter = { title: 'test data' }
    const modifier = { title: 'changed data' }

    postAdapter.
      update(filter, modifier).
      then((data) => {
        assert.equal(data.ok, 1, 'correct result')
        assert.equal(data.n, 5, 'count of matched data')
        assert.equal(data.nModified, 5, 'count of modified data')
      }).
      then(() => done()).
      catch((err) => done(err))
  })

  it('adapter - delete', function (done) {
    this.timeout(timeoutValue)

    const filter = { title: 'changed data' }

    postAdapter.
      delete(filter).
      then((data) => {
        assert.equal(data.ok, 1, 'correct result')
        assert.equal(data.n, 5, 'count of matched data')
      }).
      then(() => done()).
      catch((err) => done(err))
  })

  after((done) => {
    conns.closeAll().
      then(() => done()).
      catch((err) => done(err))
  })
})
