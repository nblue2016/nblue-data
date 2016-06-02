const assert = require('assert')
const dataLib = require('../lib')


const DbConnections = dataLib.DbConnections
const timeoutValue = 15000

const config = global.config

const proxies = [dataLib.MongoDbProxy, dataLib.MongooseProxy]
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

        const conns = createConnFunc(proxy)

        conns.
        createByConfig('conn5', config).
        then((conn) => done(new Error('unexpected open'))).
        catch((err) => done(err.code === 18 ? null : err))
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
