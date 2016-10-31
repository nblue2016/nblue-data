const assert = require('assert')
const path = require('path')
const nblue = require('nblue')
const ndata = require('../../lib')

const aq = nblue.aq
const co = aq.co
const betch = nblue.betch

const ConfigMap = nblue.ConfigMap
const Schemas = ndata.Schemas
const DbConnections = ndata.DbConnections

const timeoutValue = 2000

const envs = ['dev', 'debug', 'qa']

const originalTitle = 'good news'
const changedTitle = 'bad news'

const getEntity = (data) => {
  if (Array.isArray(data)) {
    return data.length > 0 ? data[0] : null
  }

  return data
}

let
  config = null,
  schemas = null

describe('adapter - init ', () => {
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

  const ary = [0, 1]
  const proxies = [
    new ndata.MongoDbProxy(),
    new ndata.MongooseProxy()
  ]

  ary.forEach((index) => {
    const proxyName = index === 0 ? 'MongoDb' : 'Mongoose'

    describe(`adapter - create instance (${proxyName})`, () => {
      it(`create adpater with betch`, function (done) {
        this.timeout(5000)

        const ctx = {}
        const conns = new DbConnections(schemas)

        conns.registerProxy('mongodb:', proxies[index])
        conns.createByConfigs(config)

        betch({
          _open: conns.open('conn1'),
          adapter: () => conns.getAdapter('post'),
          post: (cx) => cx.adapter.create({ title: 'test1' }),
          _del: (cx) => cx.adapter.delete({ _id: cx.post._id }),
          _end: conns.close('conn1')
        }, ctx).
        then((data) => done()).
        catch((err) => done(err))
      })

      it(`create adpater with co`, function (done) {
        this.timeout(5000)

        const conns = new DbConnections(schemas)

        conns.registerProxy('mongodb:', proxies[index])
        conns.createByConfigs(config)

        co(function *() {
          yield conns.open('conn1')

          const adapter = yield conns.getAdapter('post')

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

    describe(`adapter - crud operations (${proxyName})`, () => {
      const insertedPosts = []

      let
        catagoryAdapter = null,
        conns = null,
        postAdapter = null,
        userAdapter = null

      before((done) => {
        conns = new DbConnections(schemas)
        conns.registerProxy('mongodb:', proxies[index])
        conns.createByConfigs(config)

        co(function *() {
          // open all database
          yield conns.openAll()

          // get adapters
          catagoryAdapter = yield conns.getAdapter('category')
          postAdapter = yield conns.getAdapter('post')
          userAdapter = yield conns.getAdapter('user')

          // clear old data
          return betch([
            catagoryAdapter.delete({}),
            postAdapter.delete({}),
            userAdapter.delete({})
          ])
        }).
        then(() => done()).
        catch((err) => done(err))
      })

      it('ready', () => null)

      it('create post with callback', function (done) {
        this.timeout(timeoutValue)

        postAdapter.
          create(
            { title: originalTitle },
            {},
            (err, data) => {
              if (err) return done(err)

              assert.equal(data.title, originalTitle, 'same value of title')

              insertedPosts.push(data._id)

              return done()
            }
          )
      })

      it('create post with promise', function (done) {
        this.timeout(timeoutValue)

        postAdapter.
          create({ title: originalTitle }).
          then((data) => {
            assert.equal(data.title, originalTitle, 'same value of title')

            return data
          }).
          then((data) => insertedPosts.push(data._id)).
          then(() => done()).
          catch((err) => done(err))
      })

      it('retrieve and update post with promise', function (done) {
        this.timeout(timeoutValue * 3)

        co(function *() {
          let
            data = null,
            post = null

          // get post by _id
          data = yield postAdapter.
            retrieve({ _id: insertedPosts[0] })
          post = getEntity(data)

          // check value of title
          assert.equal(post.title, originalTitle, 'check title')

          // change post data
          post.title = changedTitle

          // call update to save changes
          data = yield postAdapter.
            update({ _id: insertedPosts[0] }, { title: changedTitle })

          if (!(data.ok && data.ok === 1)) {
            throw new Error('no one update')
          }

          // get post by _id again
          data = yield postAdapter.
            retrieve({ _id: insertedPosts[0] })
          post = getEntity(data)

          // check new value of title
          assert.equal(post.title, changedTitle, 'check changed title')
        }).
        then(() => done()).
        catch((err) => done(err))
      })

      it('retrieve list posts with promise', function (done) {
        this.timeout(timeoutValue * 3)

        co(function *() {
          const posts = yield postAdapter.
            retrieve({
              _id: {
                $in: [insertedPosts[0], insertedPosts[1]]
              }
            })

          assert.equal(
            posts.length, insertedPosts.length, 'check length of posts'
          )
          assert.equal(
            posts[0]._id.toString(), insertedPosts[0], 'compare the 1st id'
          )
          assert.equal(
            posts[1]._id.toString(), insertedPosts[1], 'compare the 2nd id'
          )
        }).
        then(() => done()).
        catch((err) => done(err))
      })

      it('count of posts with promise', function (done) {
        this.timeout(timeoutValue * 3)

        co(function *() {
          const count = yield postAdapter.
            count({
              _id: {
                $in: [insertedPosts[0], insertedPosts[1]]
              }
            })

          assert.equal(count, insertedPosts.length, 'got count of posts is 2')
        }).
        then(() => done()).
        catch((err) => done(err))
      })

      it('delete posts with promise', function (done) {
        this.timeout(timeoutValue)

        co(function *() {
          const deleteFunc = postAdapter.delete.bind(postAdapter)

          const deleteds = yield betch(
            insertedPosts.map((id) => deleteFunc({ _id: id }))
          )

          if (!Array.isArray(deleteds)) {
            throw new Error('Unexcepted result')
          }

          const results =
            deleteds.
              map((result) => result.ok).
              filter((val) => val === 1)

          assert.equal(
            results.length, insertedPosts.length, 'tow entites were deleted'
          )
        }).
        then(() => done()).
        catch((err) => done(err))
      })

      after((done) => {
        co(function *() {
          yield conns.closeAll()
        }).
        then(() => done()).
        catch((err) => done(err))
      })
    })
  })
})
