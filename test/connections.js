const assert = require('assert')
const core = require('nblue-core')
const data = require('../lib')

const MongoDBConnections = data.MongoDBConnections
const TIMTOUT_VALUE = 5000

describe("connections", function () {

  it('Test connection string1', function (done) {

    this.timeout(TIMTOUT_VALUE)

    const conns = new MongoDBConnections()

    conns.on('open', (conn) => conns.close(conn.Name))
    conns.on('close', (conn) => done())
    conns.on('error', (err, conn) => {done(err)})
    conns.createByConfig('conn1', config)
  })

  it('Test connection string1 again', function (done) {

    this.timeout(TIMTOUT_VALUE)

    const conns = new MongoDBConnections()

    conns.on('open', (conn) => conns.close(conn.Name))
    conns.on('close', (conn) => done())
    conns.on('error', (err, conn) => {done(err)})
    conns.createByConfig('conn1', config)
  })

  it('Test connection string4', function (done) {

    this.timeout(TIMTOUT_VALUE)

    const conns = new MongoDBConnections()

    conns.on('open', (conn) => conns.close(conn.Name))
    conns.on('close', (conn) => done())
    conns.on('error', (err, conn) => {done(err)})
    conns.createByConfig('conn4', config)
  })

  it('Test connection string5, auth failed', function (done) {

    this.timeout(TIMTOUT_VALUE)

    const conns = new MongoDBConnections()

    conns.on('open', (conn) => conns.close(conn.Name))
    conns.on('close', (conn) => done())
    conns.on('error', (err, conn) => done((err.code === 18) ? undefined : err))
    conns.createByConfig('conn5', config)
  })

  it('Test all connections', function (done) {

    this.timeout(TIMTOUT_VALUE * 3)

    const conns = new MongoDBConnections()

    const opened = []

    conns.on('open', (conn) => {

      if (!['conn1', 'conn4'].includes(conn.Name)) {

        done(new Error(String.format('Unexpected connection: %s was opened.', conn.Name)))
        return
      }

      opened.push(conn)
      conns.close(conn.Name)
    })
    conns.on('close', (conn) => { if (opened.length === 2) done() })
    conns.on('error', (err, conn) => { if (err.code !== 18) done(err) })

    const createConn = (name) => conns.createByConfig(name, config)

    // create every connection defined in configuration file
    for(let connections of config.get('connections') || new Map()) {
      for(let name of connections.keys()) {

        setTimeout(() => {createConn(name)}, 100)
      }
    }
  })
})
