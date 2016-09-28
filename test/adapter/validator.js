// const assert = require('assert')
const dataLib = require('../../lib')
const ValidatorError = require('../../lib/error/validator')

const config = global.config
const DbConnections = dataLib.DbConnections

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

describe('test validation for entity', () => {
  const validatorError = new Error('validator failed')

  let postAdapter = null

  before((done) => {
    postAdapter = conns.createAdapter('post')
    postAdapter.ValidateBeforeSave = true

    // clear old data
    postAdapter.
      delete({}).
      then(() => done()).
      catch((err) => done(err))
  })

  it('test invalid model key function', (done) => {
    postAdapter.create({
      title: 'test',
      name: 'invalid'
    }).then(() => {
      done(validatorError)
    }).
    catch((err) => {
      if (err instanceof ValidatorError &&
          err.Properties.has('name')) {
        done()

        return
      }

      done(err)
    })
  })

  it('test require key', (done) => {
    postAdapter.
      create({
        viewCount: 20,
        likeCount: 20
      }).
      then(() => {
        console.log('a')
        done(validatorError)
      }).
      catch((err) => {
        if (err instanceof ValidatorError &&
            err.Properties.has('title')) {
          done()

          return
        }

        done(err)
      })
  })

  it('test limit key', (done) => {
    postAdapter.create({
      title: 'test_title',
      key: 'test_key',
      viewCount: 20,
      likeCount: 20
    }).then(() => {
      done(validatorError)
    }).
    catch((err) => {
      if (err instanceof ValidatorError &&
          err.Properties.has('key')) {
        done()

        return
      }

      done(err)
    })
  })

  it('test limit of range function', (done) => {
    postAdapter.create({
      title: 'test_title',
      viewCount: 50,
      likeCount: 20
    }).then(() => {
      done(validatorError)
    }).
    catch((err) => {
      if (err instanceof ValidatorError &&
          err.Properties.has('viewCount')) {
        done()

        return
      }

      done(err)
    })
  })

  it('test limit of email', (done) => {
    postAdapter.create({
      title: 'test_title',
      email: 'aa2.abc.com',
      viewCount: 20,
      likeCount: 20
    }).then(() => {
      done(validatorError)
    }).
    catch((err) => {
      if (err instanceof ValidatorError &&
          err.Properties.has('email')) {
        done()

        return
      }

      done(err)
    })
  })

  it('test size', (done) => {
    postAdapter.create({
      title: 'abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz',
      viewCount: 20,
      likeCount: 20
    }).then(() => {
      done(validatorError)
    }).
    catch((err) => {
      if (err instanceof ValidatorError &&
          err.Properties.has('title')) {
        done()

        return
      }

      done(err)
    })
  })

  it('test invalid string type', (done) => {
    postAdapter.create({
      title: 3232,
      status: 4
    }).then(() => {
      done(validatorError)
    }).
    catch((err) => {
      if (err instanceof ValidatorError &&
          err.Properties.has('title')) {
        return postAdapter.create({
          title: 'test'
        })
      }

      return done(err)
    }).
    then(() => done()).
    catch((err) => done(err))
  })

  it('test invalid number type', (done) => {
    postAdapter.create({
      title: 'test',
      status: 'unknown'
    }).then((data) => {
      done(validatorError)
    }).
    catch((err) => {
      if (err instanceof ValidatorError &&
          err.Properties.has('status')) {
        return postAdapter.create({
          title: 'test',
          status: 2
        })
      }

      return done(err)
    }).
    then(() => done()).
    catch((err) => done(err))
  })

  it('test invalid date type', (done) => {
    postAdapter.create({
      title: 'test',
      publishedOn: 'unknown'
    }).then((data) => {
      done(validatorError)
    }).
    catch((err) => {
      if (err instanceof ValidatorError &&
          err.Properties.has('publishedOn')) {
        return postAdapter.create({
          title: 'test',
          publishedOn: new Date()
        })
      }

      return done(err)
    }).
    then(() => done()).
    catch((err) => done(err))
  })

  it('test invalid string type in complex properties', (done) => {
    postAdapter.
      create({
        title: 'test_title',
        complexKey: {
          title: 1232
        },
        status: 4
      }).
      then(() => {
        done(validatorError)
      }).
      catch((err) => {
        if (err instanceof ValidatorError &&
            err.Properties.has('complexKey.title')) {
          return postAdapter.create({
            title: 'test_title',
            complexKey: {
              key1: 'sub_test_key'
            },
            status: 4
          })
        }

        return done(err)
      }).
      then(() => done()).
      catch((err) => done(err))
  })

  after(() => {
    // postAdapter.ValidateBeforeSave = false
    postAdapter = null
  })
})

after((done) => conns.
    closeAll().
    then(() => done()).
    catch((err) => done(err))
)
