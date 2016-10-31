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
        categoryAdapter = null,
        conns = null,
        postAdapter = null,
        userAdapter = null,
        userData = null

      before((done) => {
        conns = new DbConnections(schemas)
        conns.registerProxy('mongodb:', proxies[index])
        conns.createByConfigs(config)

        co(function *() {
          // open all database
          yield conns.openAll()

          // get adapters
          categoryAdapter = yield conns.getAdapter('category')
          postAdapter = yield conns.getAdapter('post')
          userAdapter = yield conns.getAdapter('user')

          userData = JSON.parse(
            yield aq.readFile(path.join(__dirname, 'users.json'), 'utf-8')
          )

          // clear old data
          return betch([
            categoryAdapter.delete({}),
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

      it('create catagory with auto increment', function (done) {
        this.timeout(timeoutValue)

        const opts = categoryAdapter.getOptions()
        const auto = opts.autoIncrement || {}
        const step = auto.step || 2
        const times = 5

        let
          category = null,
          categoryID = -1,
          latestID = -step

        co(function *() {
          // get the category that has the maximun identity
          category = yield categoryAdapter.
            retrieve({}, {
              sort: { CategoryID: -1 },
              limit: 1
            })

          category = getEntity(category)
          latestID = category ? category.CategoryID : 0

          for (let i = 0; i < times; i++) {
            // create new item
            category = yield categoryAdapter.
              create({
                CategoryName: `test${i + 1}`,
                Description: 'test catagory'
              })

            categoryID = latestID + step * i

            // check category id with auto increament
            assert.equal(
              category.CategoryID, categoryID, 'get correct auto increment id'
            )
          }

          category = yield categoryAdapter.
            retrieve({}, {
              sort: { CategoryID: -1 },
              limit: 1
            })
          category = getEntity(category)

          assert.equal(
            category.CategoryID, step * (times - 1), 'check the latest item'
          )
        }).
        then(() => done()).
        catch((err) => done(err))
      })

      it('batch create users', (done) => {
        co(function *() {
          const users = yield userAdapter.create(userData)
          const count = yield userAdapter.count({})

          assert.equal(users.length, userData.length, 'created users.')
          assert.equal(count, userData.length, 'count of users.')
        }).
        then(() => done()).
        catch((err) => done(err))
      })

      it('find one by filter for users', (done) => {
        co(function *() {
          const user = yield userAdapter.retrieve({}, { method: 'findOne' })

          assert.equal(Array.isArray(user), false, 'only found one element')
          assert.equal(user.nick, 'test01', 'only found one element')
        }).
        then(() => done()).
        catch((err) => done(err))
      })

      it('complex filter for users', (done) => {
        let users = null

        // userAdapter.SimpleData = true

        co(function *() {
          // test for all users
          users = yield userAdapter.retrieve({})

          assert.equal(users.length, 12, 'filter all users.')


          // test for limit
          users = yield userAdapter.retrieve({}, { limit: 8 })

          assert.equal(users.length, 8, 'filter users (limit: 8).')


          // test for top
          users = yield userAdapter.retrieve({}, { top: 6 })

          assert.equal(users.length, 6, 'filter users (top: 6).')


          // test for filter1
          users = yield userAdapter.retrieve({ gender: 1 })

          assert.equal(users.length, 9, 'filter users (filter {gender: 1}).')


          // test for filter2
          users = yield userAdapter.retrieve({ gender: 2 })

          assert.equal(users.length, 3, 'filter users (filter {gender: 2}).')


          // test for filter3
          users = yield userAdapter.retrieve({ nick: 'test08' })
          assert.equal(
            users[0].email,
            'test08@abc.com',
            'filter users (filter {nick: test08}).'
          )


          // test for pager settings 1
          users = yield userAdapter.
            retrieve({}, {
              sort: {
                nick: 1
              },
              pageSize: 3,
              page: 2
            })

          assert.equal(users.length, 3, 'count of matched users by pager.')
          assert.equal(users[0].nick, 'test04', 'the 1st user in page 2 ')
          assert.equal(users[1].nick, 'test05', 'the 2nd user in page 2 ')
          assert.equal(users[2].nick, 'test06', 'the 3rd user in page 2 ')


          // test for pager settings 2
          users = yield userAdapter.
            retrieve({}, {
              sort: {
                nick: 1
              },
              pageSize: 5,
              page: 3
            })

          assert.equal(users.length, 2, 'count of matched users by pager2.')
          assert.equal(users[0].nick, 'test11', 'the 1st user in page 2 ')
          assert.equal(users[1].nick, 'test12', 'the 2nd user in page 2 ')

          // test for complex filter
          users = yield userAdapter.
            retrieve({}, {
              projection: {
                _id: 0,
                nick: 1,
                email: 1
              },
              sort: {
                nick: 1
              },
              pageSize: 5,
              page: 3
            })

          assert.equal(
            users.length, 2, 'the count of matched users by complex filter.'
          )

          assert.deepEqual(
            Object.keys(users[0]).sort(),
            ['email', 'nick'],
            'properties of the 1st user'
          )

          assert.deepEqual(
            Object.keys(users[1]).sort(),
            ['email', 'nick'],
            'properties of the 1st user'
          )
        }).
        then(() => done()).
        catch((err) => done(err))
      })

      it('batch modified users', (done) => {
        co(function *() {
          const result = yield userAdapter.
            update({
              gender: 1
            }, {
              nick: 'modified'
            })

          assert.equal(result.ok, 1, 'parse ok value')
          assert.equal(result.nModified, 9, 'parse nModified value')
          assert.equal(result.n, 9, 'parse n value')

          const users = yield userAdapter.retrieve({ nick: 'modified' })

          assert.equal(users.length, 9, '9 users were updated.')
        }).
        then(() => done()).
        catch((err) => done(err))
      })

      it('batch delete users', (done) => {
        co(function *() {
          const result = yield userAdapter.delete({ gender: 2 })

          assert.equal(result.ok, 1, 'parse ok value')
          assert.equal(result.n, 3, 'parse n value')
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
