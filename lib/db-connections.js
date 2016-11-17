// const nblue = require('nblue')
const url = require('url')
const EventEmitter = require('events').EventEmitter

const Schemas = require('./schema/schemas')
const DbConnection = require('./db-connection')
const MongoDbProxy = require('./proxy/mongodb-proxy')
const OrmDbProxy = require('./proxy/orm-proxy')

// const StringBuilder = nblue.StringBuilder

class DbConnections extends EventEmitter
{

  constructor (schemas) {
    super()

    this._schemas = schemas ? schemas : Schemas.create()

    this._proxies = new Map()
    this._connections = new Map()

    this.registerProxy('mongodb:', new MongoDbProxy())
    this.registerProxy('mysql:', new OrmDbProxy())
    this.registerProxy('sqlite:', new OrmDbProxy())
  }

  get Schemas () {
    return this._schemas
  }

  getConnection (name) {
    const that = this

    if (!that._connections.has(name)) {
      throw new Error(`The connection(${name}) wasn't created.`)
    }

    return that._connections.get(name)
  }

  createConnection (name) {
    const that = this

    return that.getConnection(name).clone()
  }

  getConnectionByEntity (entityName) {
    const that = this
    const schema = that.Schemas.getSchema(entityName)

    if (!schema) {
      throw new Error(`can't find schema by name :${entityName}`)
    }

    if (!schema.database) {
      throw new Error(`can't find database for schema (${entityName}).`)
    }

    return that.getConnection(schema.database)
  }

  create (name, connectionString, options) {
    const that = this

    return that.registerConnection(
      name,
      connectionString,
      options || {}
    )
  }

  createByConfig (name, config) {
    const that = this

    return that.create(
      name,
      config.getConnectionString(name)
    )
  }

  createByConfigs (config) {
    const that = this
    const items = []

    for (const conns of config.get('connections') || new Map()) {
      for (const key of conns.keys()) {
        items.push({
          name: key,
          connectionString: conns.get(key)
        })
      }
    }

    return items.
      map(
        (item) => that.create(item.name, item.connectionString)
      )
  }

  registerConnection (name, connectionString, options) {
    // declare
    const that = this
    const opts = {}

    if (that._connections.has(name)) {
      throw new Error('Current name:${name} has been registered!')
    }

    // parse connection string
    const parsedUrl = url.parse(connectionString)

    // check protocol was registered or not
    if (!that._proxies.has(parsedUrl.protocol)) {
      throw new Error(`Doesn't support protocol: ${parsedUrl.protocol}`)
    }

    // get proxy by protocol
    const proxy = that._proxies.get(parsedUrl.protocol)

    // assign options
    if (typeof options === 'function') {
      Object.assign(opts, options())
    } else if (typeof options === 'object') {
      Object.assign(opts, options)
    }

    const conn = proxy.createConnection(connectionString, opts)

    if (!conn.Name) {
      conn.Name = name
    }

    // append connection to cache
    that._connections.set(name, conn)

    that.emit('create', name)

    return conn
  }

  registerProxy (protocol, proxy) {
    const that = this

    if (!protocol) throw new Error('invalid protocol')
    if (!proxy) throw new Error('invalid protocol')

    that._proxies.set(protocol, proxy)
  }

  open (name, callback) {
    const that = this

    if (!that._connections.has(name)) {
      throw new Error(`Can't find connection by name: ${name}`)
    }

    const conn = that._connections.get(name)

    // current connection has been opend, only return conn
    if (conn.IsOpened) {
      if (callback) {
        return callback(null, conn)
      }

      return Promise.resolve(conn)
    }

    // bind events
    const bindFunc = that._bindHandlers.bind(that)

    bindFunc(conn)

    return conn.open(callback)
  }

  close (name, callback) {
    const that = this

    if (!that._connections.has(name)) {
      throw new Error(`Can't find connection by name: ${name}`)
    }

    // bind events
    const removeFunc = that._removeHandlers.bind(that)
    const conn = that._connections.get(name)

    let cb = null

    if (callback) {
      const cbo = callback

      cb = function (err, data) {
        cbo(err, data)
        removeFunc(conn)

        return 0
      }
    }

    if (!conn.IsOpened) {
      if (cb) {
        return cb(null, conn)
      }

      return Promise.resolve(conn)
    }

    return conn.
      close(cb).
      finally(() => {
        removeFunc(conn)
      })
  }

  openAll (callback) {
    const that = this
    const conns = []
    const errs = {}

    for (const name of that._connections.keys()) {
      conns.push(name)
    }

    const resolveFunc = that._resolve.bind(that)
    const pending = Promise.all(
      conns.map(
        (name) => that.
          open(name).
          catch((err) => {
            errs[name] = err

            return null
          })
        )
    )

    return resolveFunc(pending, callback, errs)
  }

  closeAll (callback) {
    const that = this
    const conns = []
    const errs = {}

    for (const conn of that._connections.keys()) {
      conns.push(conn)
    }

    const pending = Promise.all(
      conns.map(
        (name) => that.
          close(name).
          catch((err) => {
            errs[name] = err

            return null
          })
      )
    )

    return that.
      _resolve(pending, callback, errs)
  }

  getAdapter (entityName, callback) {
    const that = this

    const schema = that.Schemas.getSchema(entityName)
    const name = schema.database
    const conn = that.getConnection(name)

    return Promise.
      resolve(conn).
      then((data) => {
        if (data.IsOpened) return data

        // open connections
        return that.open(name)
      }).
      then((data) => conn.getAdapter(schema, callback))
  }

  _resolve (pending, callback, errs) {
    const err = Object.keys(errs).length === 0
      ? null
      : new Error('Issue for connections')

    if (err) err.details = errs

    if (callback) {
      return pending.
        then((data) => {
          if (err) return callback(err, null)

          return callback(null, data)
        }).
        catch((err2) => callback(err2, null))
    }

    return pending.then((data) => {
      if (err) {
        return Promise.reject(err)
      }

      return data
    })
  }

  _bindHandlers (conn) {
    const that = this

    conn.on('error', that._errorHandler.bind(that))
    conn.on('open', that._openHandler.bind(that))
    conn.on('close', that._closeHandler.bind(that))
  }

  _removeHandlers (conn) {
    const that = this

    conn.removeListener('error', that._errorHandler.bind(that))
    conn.removeListener('open', that._openHandler.bind(that))
    conn.removeListener('close', that._closeHandler.bind(that))
  }

  _errorHandler (err, conn) {
    const that = this

    that.emit('error', err, conn.Name)
  }

  _createHandler (conn) {
    const that = this

    that.emit('create', conn.Name)
  }

  _openHandler (conn) {
    const that = this

    that.emit('open', conn.Name)
  }

  _closeHandler (conn) {
    const that = this

    that.emit('close', conn.Name)
  }

  _createErrors (errs) {
    const err = new Error('Issue for connections')

    err.details = errs

    return err
  }

}

module.exports = DbConnections
