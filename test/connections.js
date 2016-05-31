const dataLib = require('../lib')


const DbConnections = dataLib.MongoDbConnections
const timeoutValue = 15000

const config = global.config

describe('connections', () => {
  it('Test connection string1', function (done) {
    this.timeout(timeoutValue)

    const conns = new DbConnections()

    conns.on('open', (conn) => conns.close(conn.Name))
    conns.on('close', (conn) => done())
    conns.on('error', (err, conn) => done(err))
    conns.createByConfig('conn1', config)
  })

  it('Test connection string1 again', function (done) {
    this.timeout(timeoutValue)

    const conns = new DbConnections()

    conns.on('open', (conn) => conns.close(conn.Name))
    conns.on('close', (conn) => done())
    conns.on('error', (err, conn) => done(err))
    conns.createByConfig('conn1', config)
  })

  it('Test connection string4', function (done) {
    this.timeout(timeoutValue)

    const conns = new DbConnections()

    conns.on('open', (conn) => conns.close(conn.Name))
    conns.on('close', (conn) => done())
    conns.on('error', (err, conn) => {
      console.log(err.message)
      done(err)
    }
    )
    conns.createByConfig('conn4', config)
  })

  it('Test connection string5, auth failed', function (done) {
    this.timeout(timeoutValue)

    const conns = new DbConnections()

    conns.on('open', (conn) => conns.close(conn.Name))
    conns.on('close', (conn) => done())
    conns.on('error', (err, conn) => done(err.code === 18 ? null : err))
    conns.createByConfig('conn5', config)
  })

  it('Test all connections', function (done) {
    this.timeout(timeoutValue * 3)

    const conns = new DbConnections()

    const opened = []

    conns.on('open', (conn) => {
      if (!['conn1', 'conn4'].includes(conn.Name)) {
        const errMessage =
          String.format('Unexpected connection: %s was opened.', conn.Name)

        done(new Error(errMessage))

        return
      }

      opened.push(conn)
      conns.close(conn.Name)
    })

    conns.on('close', (conn) => {
      if (opened.length === 2) done()
    })
    conns.on('error', (err, conn) => {
      if (err.code !== 18) done(err)
    })

    conns.createByConfigs(config)
  })
})
