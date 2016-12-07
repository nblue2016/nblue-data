// const assert = require('assert')
const path = require('path')
const nblue = require('nblue-core')
const ndata = require('../../lib')

const betch = nblue.betch

const ConfigMap = nblue.ConfigMap
const Schemas = ndata.Schemas
const DbConnections = ndata.DbConnections
const ValidatorError = ndata.ValidatorError

// const timeoutValue = 2000
const validatorError = new Error('validator failed')
const catchError = (err, name, done) => {
  if (err instanceof ValidatorError &&
      err.Properties.has(name)) {
    return
  }

  throw err
}

const envs = ['dev', 'debug', 'qa']

describe('validator', () => {
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
      postAdapter.ValidateBeforeSave = true

      return null

      // return postAdapter.delete({})
    }).
    then(() => done()).
    catch((err) => done(err))
  })

  it('model keys', (done) => {
    postAdapter.create({
      title: 'test',
      name: 'invalid'
    }).
    then(() => Promise.reject(validatorError)).
    catch((err) => catchError(err, 'name')).
    then(() => done()).
    catch((err) => done(err))
  })

  it('require key', (done) => {
    postAdapter.
      create({
        viewCount: 20,
        likeCount: 20
      }).
      then(() => Promise.reject(validatorError)).
      catch((err) => catchError(err, 'title')).
      then(() => done()).
      catch((err) => done(err))
  })

  it('limit key', (done) => {
    postAdapter.create({
      title: 'test_title',
      key: 'test_key',
      viewCount: 20,
      likeCount: 20
    }).
    then(() => Promise.reject(validatorError)).
    catch((err) => catchError(err, 'key')).
    then(() => done()).
    catch((err) => done(err))
  })

  it('limit of range function', (done) => {
    postAdapter.create({
      title: 'test_title',
      viewCount: 50,
      likeCount: 20
    }).
    then(() => Promise.reject(validatorError)).
    catch((err) => catchError(err, 'viewCount')).
    then(() => done()).
    catch((err) => done(err))
  })

  it('limit of email', (done) => {
    postAdapter.create({
      title: 'test_title',
      email: 'aa2.abc.com',
      viewCount: 20,
      likeCount: 20
    }).
    then(() => Promise.reject(validatorError)).
    catch((err) => catchError(err, 'email')).
    then(() => done()).
    catch((err) => done(err))
  })

  it('size of string', (done) => {
    postAdapter.create({
      title: 'abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz',
      viewCount: 20,
      likeCount: 20
    }).
    then(() => Promise.reject(validatorError)).
    catch((err) => catchError(err, 'title')).
    then(() => done()).
    catch((err) => done(err))
  })

  it('invalid string type', (done) => {
    postAdapter.create({
      title: 3232,
      status: 4
    }).
    then(() => Promise.reject(validatorError)).
    catch((err) => catchError(err, 'title')).
    then(() => postAdapter.create({ title: 'test' })).
    then(() => done()).
    catch((err) => done(err))
  })

  it('invalid number type', (done) => {
    postAdapter.create({
      title: 'test',
      status: 'unknown'
    }).
    then(() => Promise.reject(validatorError)).
    catch((err) => catchError(err, 'status')).
    then(() => postAdapter.create({
      title: 'test',
      status: 2
    })).
    then(() => done()).
    catch((err) => done(err))
  })

  it('invalid date type', (done) => {
    postAdapter.create({
      title: 'test',
      publishedOn: 'unknown'
    }).
    then(() => Promise.reject(validatorError)).
    catch((err) => catchError(err, 'publishedOn')).
    then(() => postAdapter.create({
      title: 'test',
      publishedOn: new Date()
    })).
    then(() => done()).
    catch((err) => done(err))
  })

  it('invalid string type in complex properties', (done) => {
    postAdapter.
      create({
        title: 'test_title',
        complexKey: { title: 1232 },
        status: 4
      }).
      then(() => Promise.reject(validatorError)).
      catch((err) => catchError(err, 'complexKey.title')).
      then(() => postAdapter.create({
        title: 'test_title',
        complexKey: { key1: 'sub_test_key' },
        status: 4
      })).
      then(() => done()).
      catch((err) => done(err))
  })

  after((done) => {
    conns.closeAll().
      then(() => done()).
      catch((err) => done(err))
  })
})
