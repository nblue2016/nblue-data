const querystring = require('querystring')
const url = require('url')

const Mongoose = require('mongoose')
const MongoClient = require('mongodb').MongoClient
const EventEmitter = require('events').EventEmitter

const SchemaCache = require('./schemacache')
const MongoDbConnection = require('./mongodbconnection')
const MongoDbAdapter = require('./mongodb-adapter')
const MongooseDbAdapter = require('./mongoose-adapter')

const schemaType = 'mongo'

/*
const defaultOptions = {
  db: { native_parser: true },
  auth: { authdb: 'admin' },
  server: { poolSize: 10 }
}
*/

class MongoDbConnections extends EventEmitter {

  constructor () {
    super()

    this._driver = 'mongoose'
    this._schemas = SchemaCache.create()
    this._connections = new Map()
    this._mongoosePool = new Map()
    this._models = new Map()
  }

  get Connections () {
    return this._connections
  }

  get Driver () {
    return this._driver
  }
  set Driver (val) {
    if (!val) throw new Error('invalid value for mongo driver')

    switch (val) {
    case 'mongodb':
    case 'mongoose':
      this._driver = val
      break
    default:
      throw new Error(`Doesn't support driver name: ${val}`)
    }
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

  static parseUrl (mongoUrl, driver='mongoose') {
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
          if (driver === 'mongoose') {
            if (!mongoOptions.auth) mongoOptions.auth = {}

            mongoOptions.auth.authDb = qy[key]
          } else if (driver === 'mongodb') {
            mongoOptions.authSource = qy[key]
          }
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

  define (schemas) {
    this._schemas.createSchemas(schemas, schemaType)
  }

  get (name) {
    return this.getByName(name)
  }

  getByName (name) {
    const ctx = this
    const conns = ctx.Connections

    if (conns.has(name)) {
      return conns.get(name)
    }

    return null
  }

  getByConnectionString (connectionString) {
    const conns = this.Connections

    for (const conn of conns.values()) {
      if (conn.ConnectionString ===
        connectionString) {
        return conn
      }
    }

    return null
  }

  create (name, connectionString, options) {
    const ctx = this

    let conn = null

    conn = ctx.getByName(name)
    if (conn !== null) return Promise.resolove(conn)

    conn = ctx.getByConnectionString(connectionString)
    if (conn !== null) return Promise.resolove(conn)

    return ctx._create(
      name,
      connectionString,
      options
    )
  }

  createByConfig (name, config) {
    const ctx = this
    const dbUrl = config.getConnectionString(name)

    const {
      connectionString: c1,
      options: o1
    } = MongoDbConnections.parseUrl(dbUrl, ctx.Driver)

    return ctx.create(name, c1, o1)
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

    let adapter = null

    if (ctx.Driver === 'mongoose') {
      adapter = new MongooseDbAdapter(name, ctx)
    } else {
      adapter = new MongoDbAdapter(name, ctx)
    }

    return adapter
  }

  _create (name, connectionString, options, caller) {
    if (!connectionString) {
      throw new Error('Invalid connection string')
    }

    const ctx = caller ? caller : this
    const pool = ctx.Pool
    const conns = ctx.Connections

    if (pool.has(connectionString)) {
      return Promise.resolve(
        new MongoDbConnection(
          name,
          connectionString,
          pool.get(connectionString))
        )
    }

    let
      promise = null

    switch (ctx.Driver) {
    case 'mongoose':
      promise = ctx._createMongoose
      break
    case 'mongodb':
      promise = ctx._createMongoDb
      break
    default:
      return Promise.reject(new Error('invalid driver'))
    }

    return promise(connectionString, options).
      then((conn) => {
        if (!pool.has(connectionString)) {
          pool.set(connectionString, conn)
        }

        return new MongoDbConnection(name, connectionString, conn)
      }).
      then((conn) => {
        ctx.emit('open', conn)

        conn.Connected = true
        ctx.emit('connected', conn)

        if (!conns.has(conn.Name)) {
          conns.set(conn.Name, conn)
        }

        return conn
      }).
      catch((err) => Promise.reject(err))
  }

  _createMongoose (cs, options) {
    return new Promise((resolve, reject) => {
      Mongoose.createConnection(
        cs,
        options,
        (err, conn) => {
          if (err) {
            reject(err)
          } else {
            resolve(conn)
          }
        })
      try {
        const conn = Mongoose.createConnection(cs, options)

        resolve(conn)
      } catch (err) {
        reject(err)
      }
    })
  }

  _createMongoDb (cs, options) {
    return new Promise((resolve, reject) => {
      MongoClient.connect(
        cs,
        options,
        (err, conn) => {
          if (err) {
            reject(err)
          } else {
            resolve(conn)
          }
        })
    })
  }

  close (name, callback) {
    const ctx = this
    const conn = ctx.get(name)

    const promise = new Promise((resolve, reject) => {
      if (!conn) {
        reject(new Error(`Can't find connection by name: ${name}`))

        return
      }

      const mongoConn = conn.Connection

      mongoConn.close((err) => {
        if (err) {
          ctx.emit('error', err, conn)
          reject(err)
        }

        ctx.emit('close', conn)
        conn.Connected = false
        ctx.emit('disconnected', conn)

        resolve(conn)
      })
    })

    if (callback) {
      return promise.
        then((data) => callback(null, data)).
        catch((err) => callback(err))
    }

    return promise
  }

  closeAll () {
    const ctx = this
    const conns = ctx.Connections

    for (const key of conns.keys()) {
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

/*
  attachEvents (conn) {
    const ctx = this

    if (!conn || !conn.Connection) return

    // get instance of connection from conn
    const mongoConn = conn.Connection

    // bind open event
    mongoConn.on('open', () => ctx.emit('open', conn))

    // bind connected event
    mongoConn.on('connected', () => {
      if (!conn.Connected) conn.Connected = true
      ctx.emit('connected', conn)
    })

    // bind disconnected event
    mongoConn.on('disconnected', () => {
      if (conn.Connected) conn.Connected = false
      ctx.emit('disconnected', conn)
    })

    // bind close event
    mongoConn.on('close', () => ctx.emit('close', conn))

    // bind error event
    mongoConn.on('error', (err) => ctx.emit('error', err, conn))
  }
*/

}

module.exports = MongoDbConnections
