// const assert = require('assert')
const nblue = require('nblue')
const ndata = require('../lib')

const ConfigMap = nblue.ConfigMap
const DbConnections = ndata.DbConnections

const envs = ['dev', 'debug', 'qa']

describe('connections - create methods', () => {
  let config = null

  before((done) => {
    const configFile = String.format('%s/config.yml', __dirname)

    ConfigMap.
      parseConfig(configFile, envs).
      then((data) => {
        config = data

        done()
      }).
      catch((err) => done(err))
  })

  it('Test method of createByConfig by promise', function (done) {
    this.timeout(2000)

    const conns = new DbConnections()
    const conn = conns.createByConfig('conn1', config)

    conn.
      open().
      then((data) => conn.close()).
      then(() => done()).
      catch((err) => done(err))
  })

  it('Test method of createByConfig by callback', function (done) {
    this.timeout(2000)

    const conns = new DbConnections()
    const conn = conns.createByConfig('conn1', config)

    conn.open((err) => {
      if (err) done(err)
      else {
        conn.close((err2) => {
          if (err) done(err2)
          else done()
        })
      }
    })
  })
})


/*
const DbConnections = ndata.DbConnections
const timeoutValue = 15000

const config = global.config

const proxies = [ndata.MongoDbProxy, ndata.MongooseProxy]
const createConnFunc = (proxy) => {
  const Proxy = proxy
  const conns = new DbConnections()

  conns.registerProxy('mongodb:', new Proxy())

  return conns
}

proxies.
  forEach((proxy) => {
    const Proxy = proxy

    describe(`Test connections with ${Proxy.name}`, () => {
      before('before', (done) => {
        // console.log('before')
        done()
      })

      it('Test connection string1', function (done) {
        this.timeout(timeoutValue)

        const conns = createConnFunc(proxy)

        conns.
          createByConfig('conn1', config).
          then((conn) => conns.close(conn.Name)).
          then(() => done()).
          catch((err) => done(err))
      })

      it('Test connection string1 again', function (done) {
        this.timeout(timeoutValue)

        const conns = createConnFunc(proxy)

        conns.
          createByConfig('conn1', config).
          then((conn) => conns.close(conn.Name)).
          then(() => done()).
          catch((err) => done(err))
      })

      it('Test connection string4', function (done) {
        this.timeout(timeoutValue)

        const conns = createConnFunc(proxy)

        conns.
          createByConfig('conn4', config).
          then((conn) => conns.close(conn.Name)).
          then(() => done()).
          catch((err) => done(err))
      })

      it('Test connection string5, auth failed', function (done) {
        this.timeout(timeoutValue)

        const callback = () => null
        const conns = createConnFunc(proxy)

        process.on('unhandledRejection', callback)

        conns.
          createByConfig('conn5', config).
          then((conn) => done(new Error('unexpected open'))).
          catch((err) => {
            done(err.code === 18 ? null : err)
          }).
          finally(() => {
            setTimeout(() => {
              process.removeListener('unhandledRejection', callback)
            }, 500)
          })
      })

      it('Test all connections', function (done) {
        this.timeout(timeoutValue * 3)

        const conns = createConnFunc(proxy)

        const opened = []
        const connected = []
        const disconnected = []
        const closed = []

        conns.on('open', (name) => opened.push(name))
        conns.on('connected', (name) => connected.push(name))
        conns.on('disconnected', (name) => disconnected.push(name))
        conns.on('close', (name) => closed.push(name))

        conns.on('error', (err) => {
          if (err.code === 18) return

          done(err)
        })

        conns.
          createByConfigs(config).
          then((data) => {
            assert.equal(opened.length, 5, '5 conns were opened')

            assert.equal(connected.length, 2, '2 conns were connected')
            assert.equal(connected.includes('conn4'), true, 'conn4 was created')
            assert.equal(
              connected.includes('conn1') ||
                connected.includes('conn2') ||
                connected.includes('conn3'),
              true,
              'conn1, conn2 or conn3 was created')

            assert.equal(
              data[data.length - 1],
              null,
              'conn5 should be null reference')
          }).
          then(() => conns.closeAll()).
          then(() => {
            assert.equal(disconnected.length, 2, '2 conns were disconnected')
            assert.equal(
              disconnected.includes('conn1') ||
                disconnected.includes('conn2') ||
                disconnected.includes('conn3'),
              true,
              'conn1, conn2 or conn3 was disconnected')
            assert.equal(
              disconnected.includes('conn4'), true, 'conn4 was disconnected')
            assert.equal(closed.length, 4, '4 conns were closed')

            done()
          }).
          catch((err) => done(err))
      })
    })
  })
*/
