// const assert = require('assert')
const path = require('path')
const nblue = require('nblue')
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
    return done ? done() : null
  }

  return done ? done(err) : null
}

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
      postAdapter.ValidateBeforeSave = true

      return null

      // return postAdapter.delete({})
    }).
    then(() => done()).
    catch((err) => done(err))
  })

  it('validator - model keys', (done) => {
    postAdapter.create({
      title: 'test',
      name: 'invalid'
    }).
    then(() => done(validatorError)).
    catch((err) => catchError(err, 'name', done))
  })

  it('validator - require key', (done) => {
    postAdapter.
      create({
        viewCount: 20,
        likeCount: 20
      }).
      then(() => done(validatorError)).
      catch((err) => catchError(err, 'title', done))
  })

  it('validator - limit key', (done) => {
    postAdapter.create({
      title: 'test_title',
      key: 'test_key',
      viewCount: 20,
      likeCount: 20
    }).
    then(() => done(validatorError)).
    catch((err) => catchError(err, 'key', done))
  })

  it('validator - limit of range function', (done) => {
    postAdapter.create({
      title: 'test_title',
      viewCount: 50,
      likeCount: 20
    }).
    then(() => done(validatorError)).
    catch((err) => catchError(err, 'viewCount', done))
  })

  it('validator - limit of email', (done) => {
    postAdapter.create({
      title: 'test_title',
      email: 'aa2.abc.com',
      viewCount: 20,
      likeCount: 20
    }).
    then(() => done(validatorError)).
    catch((err) => catchError(err, 'email', done))
  })

  it('validator - size', (done) => {
    postAdapter.create({
      title: 'abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz',
      viewCount: 20,
      likeCount: 20
    }).
    then(() => done(validatorError)).
    catch((err) => catchError(err, 'title', done))
  })

  it('validator - invalid string type', (done) => {
    postAdapter.create({
      title: 3232,
      status: 4
    }).
    then(() => done(validatorError)).
    catch((err) => catchError(err, 'title', null)).
    then(() => postAdapter.create({
      title: 'test'
    })).
    then(() => done()).
    catch((err) => done(err))
  })

  it('validator - invalid number type', (done) => {
    postAdapter.create({
      title: 'test',
      status: 'unknown'
    }).
    then((data) => done(validatorError)).
    catch((err) => catchError(err, 'status', null)).
    then(() => postAdapter.create({
      title: 'test',
      status: 2
    })).
    then(() => done()).
    catch((err) => done(err))
  })

  it('validator - invalid date type', (done) => {
    postAdapter.create({
      title: 'test',
      publishedOn: 'unknown'
    }).
    then((data) => done(validatorError)).
    catch((err) => catchError(err, 'publishedOn', null)).
    then(() => postAdapter.create({
      title: 'test',
      publishedOn: new Date()
    })).
    then(() => done()).
    catch((err) => done(err))
  })

  it('validator - invalid string type in complex properties', (done) => {
    postAdapter.
      create({
        title: 'test_title',
        complexKey: { title: 1232 },
        status: 4
      }).
      then(() => done(validatorError)).
      catch((err) => catchError(err, 'complexKey.title', null)).
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
