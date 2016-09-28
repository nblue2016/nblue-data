const assert = require('assert')
const dataLib = require('../../lib')

const config = global.config
const DbConnections = dataLib.DbConnections

const timeOutValue = 5000

const createConnFunc = (proxy) => {
  const Proxy = proxy
  const conns = new DbConnections()

  conns.registerProxy('mongodb:', new Proxy())

  return conns
}

const conns = createConnFunc(dataLib.MongoDbProxy)

before(function (done) {
  const ctx = this

  ctx.timeout(20000)

  conns.
    createByConfigs(config).
    then(() => done()).
    catch((err) => done(err))
})

describe('Test default value', () => {
  let postAdapter = null

  before((done) => {
    postAdapter = conns.createAdapter('post')

    // clear old data
    postAdapter.
            delete({}).
            then(() => done()).
            catch((err) => done(err))
  })

  it('test default value and bind methods', function (done) {
    this.timeout(timeOutValue)

    const post = {
      title: 'title1'
    }

    postAdapter.
      create(post).
      then((data) => {
        assert.equal(
          data.key, 'key1', 'get default value for post.key')
        assert.equal(
          data.getNewTitle(),
          `${post.title}_new`,
          'call getNewTitle method'
        )

        done()
      }).
      catch((err) => done(err))
  })

  it('test wrapper function', (done) => {
    // postAdapter.ValidateBeforeSave = true
    postAdapter.getWrapper = function () {
      return {
        name: 'post',
        to: (post) => {
          post.abstract = 'abstract-test'
          post.viewCount = 10

          return post
        },
        from: (post) => post
      }
    }

    postAdapter.create({
      title: 'test'
    }).then((data) => {
      assert.equal(data.abstract, 'abstract-test', 'tested wrapper ')
      assert.equal(data.viewCount, 10, 'tested wrapper ')
      done()
    }).
    catch((err) => done(err))
  })

  after(() => {
    postAdapter.getWrapper = null
  })
})

after((done) => conns.
    closeAll().
    then(() => done()).
    catch((err) => done(err))
)
