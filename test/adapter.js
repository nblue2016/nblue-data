const assert = require('assert')
const dataLib = require('../lib')

const aq = global.aq
const config = global.config
const MongoDbConnections = dataLib.MongoDbConnections
const MongoDbAdapter = dataLib.MongoDbAdapter

const timeOutValue = 5000
const opened = []
const insertedPosts = []

const conns = new MongoDbConnections()
const dbAdapter = new MongoDbAdapter(conns)

before(function (done) {
  this.timeout(20000)

  conns.on('open', (conn) => {
    const name = conn.Name

    opened.push(name)

    if (opened.includes('conn1') &&
      opened.includes('conn4')) {
      // release all opened
      done()
    }
  })
  conns.on('error', () => null)

  conns.createByConfigs(config)
})

describe('adapter test', () => {
  it('test', () => {
    const keys = 'test'

    assert.equal(keys, 'test', 'failed.')
  })
})

describe('adapter operate entity', () => {
  it('create entity with callback', function (done) {
    this.timeout(timeOutValue)

    dbAdapter.create(
          'post',
          { title: 'good news' },
          (err, data) => {
            if (err) done(err)
            assert(data.title, 'good news', 'same value of title')

            insertedPosts.push(data._id)

            done()
          })
  })

  it('create entity with promise', function (done) {
    this.timeout(timeOutValue)

    dbAdapter.
      create('post', { title: 'good news' }).
      then((data) => {
        assert(data.title, 'good news', 'same value of title')

        insertedPosts.push(data._id)

        done()
      }).
      catch((err) => done(err))
  })

  it('retrieve and update entity with promise', function (done) {
    this.timeout(timeOutValue * 3)

    dbAdapter.
      retrieve('post', { _id: insertedPosts[0] }).
      then((data) => {
        const post = Array.isArray(data) ? data[0] : data

        assert(post.title, 'good news', 'same value of title')

        post.title = 'bad news'

        return dbAdapter.update('post',
          { _id: insertedPosts[0] },
          { title: 'bad news' }
        )
      }).
      then((data) => {
        if (data.ok && data.ok === 1) {
          return dbAdapter.
            retrieve('post', { _id: insertedPosts[0] })
        }

        throw new Error('no one update')
      }).
      then((data) => {
        const post = Array.isArray(data) ? data[0] : data

        assert(post.title, 'bad news', 'same value of title')

        done()
      }).
      catch((err) => done(err))
  })

  it('delete entity with promise', function (done) {
    this.timeout(timeOutValue)

    const deleteFunc = dbAdapter.delete
    const deleteFuncs = insertedPosts.
      map((id) => deleteFunc.bind(dbAdapter, 'post', { _id: id }))

    aq.
      parallel(deleteFuncs).
      then((data) => {
        if (!Array.isArray(data)) throw new Error('Unexcepted result')

        const results =
          data.
            map((result) => result.ok).
            filter((val) => val === 1)

        assert.equal(results.length, 2, 'tow entites were deleted')

        done()
      }).
      catch((err) => done(err))
  })
})

after((done) => {
  conns.closeAll()
  done()
})
