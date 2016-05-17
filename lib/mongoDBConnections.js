const querystring = require('querystring')
const url = require('url')

const mongoose = require('mongoose')
const EventEmitter = require('events').EventEmitter

const SchemaCache = require('./schemaCache.js')

const schemaType = 'mongo'

const defaultOptions = {
  db: { native_parser: true },
  auth: { authdb: "admin" },
  server: { poolSize: 10 }
}

class MongoDBConnection
{
  constructor (name, connectionString, connection)
  {
    this._name = name
    this._connectionString = connectionString
    this._connection = connection
    this._connected = false
  }

  get Name () { return this._name }
  get ConnectionString () { return this._connectionString }
  get Connection () { return this._connection }

  get Connected () { return this._connected }
  set Connected (val) { this._connected = val }
}

class MongoDBConnections extends EventEmitter
{
  constructor ()
  {
    super()

    this._schemas = SchemaCache.create()
    this._connections = new Map()
    this._mongoosePool = new Map()
  }

  get Names () {
    const ctx = this
    let names = []

    for(let name of ctx._connections.keys()) {
      names.push(name)
    }

    return names
  }

  get Schemas () { return this._schemas.getSchemas(schemaType) }

  static parseUrl (mongoUrl)
  {
    const cs = url.parse(mongoUrl)
    const qy = querystring.parse(cs ? (cs.query || {}) : {} )

    if (Object.keys(qy).length === 0) {
      return {
        connectionString: mongoUrl,
        options: null
      }
    }

    const mongoOptions = {}
    let user = undefined
    let password = undefined

    // parse user and password by url
    if (cs.auth) {
      const index = cs.auth.indexOf(':')
      if (index >= 0) {
        user = cs.auth.substring(0, index)
        password = cs.auth.substring(index + 1, cs.auth.length)
      }
      else user = cs.auth
    }
    if (user) mongoOptions.user = user
    if (password) mongoOptions.pass = password

    // process specail keys in options
    Object.keys(qy)
      .forEach( key => {
        switch(key.toLowerCase()) {
        case 'authdb':
          if (!mongoOptions.auth) mongoOptions.auth = {}

          mongoOptions.auth.authDb = qy[key]
          break
        default:
          mongoOptions[key] = qy[key]
          break
        }
      })

    const host = (cs.auth) ? String.format("%s@%s", cs.auth, cs.host) : cs.host

    return {
      connectionString: String.format("mongodb://%s%s", host, cs.pathname),
      options: mongoOptions
    }
  }

  appendSchema (schemas)
  {
    this._schemas.createSchemas(schemas, schemaType)
  }

  getByConnectionString (connectionString)
  {
    for(let conn of this._connections.values()) {
      if (conn.ConnectionString === connectionString) return conn
    }

    throw new Error(`The connection string ${connectionString} wasn't initialized.`)
  }

  get (name)
  {
    return (this._connections.has(name)) ? this._connections.get(name) : null
  }

  create (name, connectionString, options)
  {
    // assign current context
    const ctx = this

    // return connection from cache if it was creatd.
    if (ctx._connections.has(name)) return ctx.get(name)

    let conn = undefined

    // get mongoose connection by connection string
    if (ctx._mongoosePool.has(connectionString))
    {
      // get exist mongoose connection if it exists
      const existedConn = ctx._mongoosePool.get(connectionString)

      // create new instance of mongo db connection base on existed
      conn = new MongoDBConnection(name, connectionString, existedConn)
    }
    else
    {
      // create options for connection
      let mongoOptions = {}
      Object.assign(mongoOptions, defaultOptions)
      if (options !== undefined) Object.assign(mongoOptions, options)

      // create new instance of mongoose connection
      const mongoConn = mongoose.createConnection(connectionString, mongoOptions)

      if (!ctx._mongoosePool.has(connectionString))
      {
        ctx._mongoosePool.set(connectionString, mongoConn)
      }

      // create new instance of mongo db connection
      conn = new MongoDBConnection(name, connectionString, mongoConn)

      // attached events
      ctx.attachEvents(conn)
    }

    if (conn !== undefined) {

      if (!ctx._connections.has(conn.Name)) {
        ctx._connections.set(conn.Name, conn)
      }
    }

    return conn
  }

  createByConfig (name, config)
  {
    const url = config.getConnectionString(name)

    const {
      connectionString: c1,
      options: o1
    } = MongoDBConnections.parseUrl(url)

    return this.create(name, c1, o1)
  }

  close (name)
  {
    const ctx = this

    const conn = ctx.get(name)
    if (!conn) return

    if (conn)
    {
      try
      {
        let mongoConn = conn.Connection
        if (!mongoConn) return

        mongoConn.close( err => {
          if (err) ctx.emit('error', err, conn)
        })
      }
      catch(err)
      {
        ctx.emit('error', err, conn)
      }
    }
  }

  remove (name)
  {
    const ctx = this

    if (!ctx._connections.has(name)) return

    let conn = ctx._connections.get(name)
    let mongoConn = conn.Connection

    mongoConn.close(err => {
      if (err) ctx.emit('error', err, conn)
    })

    if (ctx._mongoosePool.has(conn.ConnectionString)) {
      ctx._mongoosePool.delete(conn.ConnectionString)
    }

    ctx._connections.delete(name)
  }

  attachEvents (conn)
  {
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

module.exports = MongoDBConnections
