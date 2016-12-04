const assert = require('assert')
const nblue = require('nblue')
const ndata = require('../lib')

const ConfigMap = nblue.ConfigMap
const DbConnections = ndata.DbConnections

const envs = ['dev', 'debug', 'qa']

describe('connections - init', () => {
  let config = null

  before((done) => {
    const configFile = String.format('%s/config.yml', __dirname)

    ConfigMap.
      parseConfig(configFile, envs).
      then((data) => {
        config = data
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

    describe(`connections - create methods (${proxyName})`, () => {
      it(`method of create by promise`,
        (done) => {
          const conns = new DbConnections()
          const cs = config.getConnectionString('conn1')

          conns.registerProxy('mongodb:', proxies[index])
          conns.create('test', cs)

          assert.throws(
            () => conns.create('test', cs),
            'duplication connection name'
          )

          conns.
            open('test').
            then(() => {
              const conn = conns.getConnection('test')

              assert.ok(conn, 'get connection')
              assert.ok(conn.IsOpened, 'connection was opend')
              assert.ok(conn.Instance, 'connection was created')
              assert.equal(conn.Name, 'test', 'get connection name')

              return conns.close('test')
            }).
            then(() => {
              const conn = conns.getConnection('test')

              assert.ok(conn, 'get connection')
              assert.ok(!conn.IsOpened, 'connection was closed')
              assert.ok(!conn.Instance, 'connection was released')
              assert.equal(conn.Name, 'test', 'get connection name')

              done()
            }).
            catch((err) => done(err))
        })

      it(`method of create by callback`,
        (done) => {
          const conns = new DbConnections()
          const cs = config.getConnectionString('conn1')

          conns.create('test', cs)

          conns.registerProxy('mongodb:', proxies[index])
          conns.open('test', (err) => {
            if (err) done(err)
            else {
              conns.close('test', (err2) => {
                if (err2) done(err2)
                else done()
              })
            }
          })
        })

      it(`method of create handle event`,
        (done) => {
          const conns = new DbConnections()
          const cs = config.getConnectionString('conn1')
          let opened = false

          conns.create('test', cs)
          conns.registerProxy('mongodb:', proxies[index])

          conns.on('error', (err, name) => {
            if (name === 'test') done(err)
          })
          conns.on('open', (name) => {
            if (name === 'test') opened = true
          })
          conns.on('close', (name) => {
            assert.ok(opened, 'database has been opened')

            if (name === 'test') done()
          })

          conns.
            open('test').
            then(() => conns.close('test'))
        })

      it(`method of createByConfig by promise`,
        (done) => {
          const conns = new DbConnections()
          const conn = conns.createByConfig('conn1', config)

          conns.registerProxy('mongodb:', proxies[index])

          conn.
          open().
          then((data) => conn.close()).
          then(() => done()).
          catch((err) => done(err))
        })

      it(`method of createByConfig by callback`,
        (done) => {
          const conns = new DbConnections()
          const conn = conns.createByConfig('conn1', config)

          conns.registerProxy('mongodb:', proxies[index])

          conn.open((err) => {
            if (err) done(err)
            else {
              conn.close((err2) => {
                if (err2) done(err2)
                else done()
              })
            }
          })
        })

      it(`method of createByConfigs then open with error`,
        (done) => {
          const conns = new DbConnections()

          conns.createByConfigs(config)

          conns.
              open('conn5').
              then(() => done(new Error('connection string is incorrect.'))).
              catch((err) => {
                assert.equal(err.code, 18, 'auth failed for conn5b')

                return conns.close('conn5')
              }).
              then(() => done()).
              catch((err) => done(err))
        })

      it(`method of createByConfigs then openAll with error`,
        function (done) {
          this.timeout(5000)

          const conns = new DbConnections()

          conns.createByConfigs(config)

          conns.on('error', (err, name) => {
            assert.equal(name, 'conn5', 'auth failed for conn5a')
            assert.equal(err.code, 18, 'auth failed for conn5b')
          })

          conns.
            openAll().
            catch((err) => {
              const errs = err.details

              assert.ok(errs, 'get errors')
              assert.ok(errs.conn5, 'get errors for conn5')
              assert.equal(errs.conn5.code, 18, 'get error code for conn5')

              return null
            }).
            finally(() => {
              const conn1 = conns.getConnection('conn1')
              const conn2 = conns.getConnection('conn2')
              const conn3 = conns.getConnection('conn3')
              const conn4 = conns.getConnection('conn4')
              const conn5 = conns.getConnection('conn5')

              assert.ok(conn1.IsOpened, 'conn1 was opened')
              assert.ok(conn2.IsOpened, 'conn2 was opened')
              assert.ok(conn3.IsOpened, 'conn3 was opened')
              assert.ok(conn4.IsOpened, 'conn4 was opened')
              assert.ok(!conn5.IsOpened, 'conn5 was opened')

              return conns.closeAll()
            }).
            then(() => done()).
            catch((err) => done(err)).
            finally(() => console.log(' '))
        })
    })
  })
})

describe('connections - orm', () => {
  let config = null

  before((done) => {
    const configFile = String.format('%s/config2.yml', __dirname)

    ConfigMap.
      parseConfig(configFile, envs).
      then((data) => {
        config = data

        done()
      }).
      catch((err) => done(err))
  })

  it('Test method of create by promise (ORM2 Driver)', (done) => {
    const conns = new DbConnections()
    const cs = config.getConnectionString('conn1')

    conns.create('test', cs)

    conns.
      open('test').
      then(() => conns.close('test')).
      then(() => done()).
      catch((err) => done(err))
  })
})
