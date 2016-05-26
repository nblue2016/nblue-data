const querystring = require('querystring')
const url = require('url')

const Mongoose = require('mongoose')
const EventEmitter = require('events').EventEmitter

const SchemaCache = require('./schemacache')
const MongoDBConnection = require('./mongodbconnection')
const MongoDbAdapter = require('./mongodbadapter')

const schemaType = 'mongo'

const defaultOptions = {
  db: { native_parser: true },
  auth: { authdb: 'admin' },
  server: { poolSize: 10 }
}

class MongoDbConnections extends EventEmitter {

  constructor () {
    super()

    this._schemas = SchemaCache.create()
    this._connections = new Map()
    this._mongoosePool = new Map()
    this._models = new Map()
  }

  get Connections () {
    return this._connections
  }

  get Pool () {
    return this._mongoosePool
  }

  get Names () {
    const ctx = this
    const names = []

    for (const name of ctx.Connections.keys()) {
      names.push(name)
    }

    return names
  }

  get Schemas () {
    const schemas = this._schemas.getSchemas(schemaType)

    return schemas
  }

  get Models () {
    return this._models
  }

  static parseUrl (mongoUrl) {
    const cs = url.parse(mongoUrl)
    const qy = querystring.parse(cs ? cs.query || {} : {})

    if (Object.keys(qy).length === 0) {
      return {
        connectionString: mongoUrl,
        options: null
      }
    }

    const mongoOptions = {}

    let
      password = null,
      user = null

    // parse user and password by url
    if (cs.auth) {
      const index = cs.auth.indexOf(':')

      if (index >= 0) {
        user = cs.auth.substring(0, index)
        password = cs.auth.substring(index + 1, cs.auth.length)
      } else {
        user = cs.auth
      }
    }
    if (user) mongoOptions.user = user
    if (password) mongoOptions.pass = password

    // process specail keys in options
    Object.
      keys(qy).
      forEach((key) => {
        switch (key.toLowerCase()) {
        case 'authdb':
          if (!mongoOptions.auth) mongoOptions.auth = {}

          mongoOptions.auth.authDb = qy[key]
          break
        default:
          mongoOptions[key] = qy[key]
          break
        }
      })

    const host = cs.auth ? String.format('%s@%s', cs.auth, cs.host) : cs.host

    return {
      connectionString: String.format('mongodb://%s%s', host, cs.pathname),
      options: mongoOptions
    }
  }

  appendSchema (schemas) {
    this._schemas.createSchemas(schemas, schemaType)
  }

  getByConnectionString (connectionString) {
    for (const conn of this._connections.values()) {
      if (conn.ConnectionString === connectionString) return conn
    }

    throw new Error(
      `The connection string ${connectionString} wasn't initialized.`)
  }

  get (name) {
    const ctx = this
    const conns = ctx.Connections
    const conn = conns.has(name) ? conns.get(name) : null

    return conn
  }

  create (name, connectionString, options) {
    // assign current context
    const ctx = this

    // return connection from cache if it was creatd.
    if (ctx.Connections.has(name)) return ctx.get(name)

    let conn = null

    // get mongoose connection by connection string
    if (ctx.Pool.has(connectionString)) {
      // get exist mongoose connection if it exists
      const existedConn = ctx.Pool.get(connectionString)

      // create new instance of mongo db connection base on existed
      conn = new MongoDBConnection(name, connectionString, existedConn)
    } else {
      // create options for connection
      const mongoOptions = {}

      Object.assign(mongoOptions, defaultOptions)
      if (options !== null) Object.assign(mongoOptions, options)

      // create new instance of mongoose connection
      const mongoConn =
        Mongoose.createConnection(connectionString, mongoOptions)

      if (!ctx.Pool.has(connectionString)) {
        ctx.Pool.set(connectionString, mongoConn)
      }

      // create new instance of mongo db connection
      conn = new MongoDBConnection(name, connectionString, mongoConn)

      // attached events
      ctx.attachEvents(conn)
    }

    if (conn !== null) {
      if (!ctx.Connections.has(conn.Name)) {
        ctx.Connections.set(conn.Name, conn)
      }
    }

    return conn
  }

  createByConfig (name, config) {
    const dbUrl = config.getConnectionString(name)

    const {
      connectionString: c1,
      options: o1
    } = MongoDbConnections.parseUrl(dbUrl)

    return this.create(name, c1, o1)
  }

  createByConfigs (config) {
    const ctx = this

    for (const items of config.get('connections') || new Map()) {
      for (const name of items.keys()) {
        const connectionString = items.get(name)

        if (connectionString &&
          connectionString.startsWith('mongo')) {
          setTimeout(() => ctx.createByConfig(name, config), 1)
        }
      }
    }
  }

  createAdapter (name) {
    const ctx = this
    const adapter = new MongoDbAdapter(name, ctx)

    return adapter
  }

  close (name) {
    const ctx = this
    const conn = ctx.get(name)

    if (!conn) return

    if (conn) {
      try {
        const mongoConn = conn.Connection

        if (!mongoConn) return

        mongoConn.close((err) => {
          if (err) ctx.emit('error', err, conn)
        })
      } catch (err) {
        ctx.emit('error', err, conn)
      }
    }
  }

  closeAll () {
    const ctx = this

    for (const key of this.Connections.keys()) {
      ctx.close(key)
    }
  }

  remove (name) {
    const ctx = this

    if (!ctx.Connections.has(name)) return

    const conn = ctx.Connections.get(name)
    const mongoConn = conn.Connection

    mongoConn.close((err) => {
      if (err) ctx.emit('error', err, conn)
    })

    if (ctx.Pool.has(conn.ConnectionString)) {
      ctx.Pool.delete(conn.ConnectionString)
    }

    ctx.Connections.delete(name)
  }

  attachEvents (conn) {
    const ctx = this

    if (!conn || !conn.Connection) return

    // get instance of connection from conn
    const connection = conn.Connection

    // bind connected event
    connection.on('connected', () => {
      if (!conn.Connected) conn.Connected = true
      ctx.emit('connected', conn)
    })

    // bind open event
    connection.on('open', () => ctx.emit('open', conn))

    // bind disconnected event
    connection.on('disconnected', () => {
      if (conn.Connected) conn.Connected = false
      ctx.emit('disconnected', conn)
    })

    // bind close event
    connection.on('close', () => ctx.emit('close', conn))

    // bind error event
    connection.on('error', (err) => ctx.emit('error', err, conn))
  }

}

module.exports = MongoDbConnections
