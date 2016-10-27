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
    const ctx = this

    if (!ctx._connections.has(name)) {
      throw new Error(`The connection(${name}) wasn't created.`)
    }

    return ctx._connections.get(name)
  }

  create (name, connectionString, options) {
    const ctx = this

    return ctx.registerConnection(
      name,
      connectionString,
      options || {}
    )
  }

  createByConfig (name, config) {
    const ctx = this

    return ctx.create(
      name,
      config.getConnectionString(name)
    )
  }

  createByConfigs (config) {
    const ctx = this
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
        (item) => ctx.create(item.name, item.connectionString)
      )
  }

  registerConnection (name, connectionString, options) {
    // declare
    const ctx = this
    const opts = {}

    if (ctx._connections.has(name)) {
      throw new Error('Current name:${name} has been registered!')
    }

    // parse connection string
    const parsedUrl = url.parse(connectionString)

    // check protocol was registered or not
    if (!ctx._proxies.has(parsedUrl.protocol)) {
      throw new Error(`Doesn't support protocol: ${parsedUrl.protocol}`)
    }

    // get proxy by protocol
    const proxy = ctx._proxies.get(parsedUrl.protocol)

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
    ctx._connections.set(name, conn)

    ctx.emit('create', name)

    return conn
  }

  registerProxy (protocol, proxy) {
    if (!protocol) throw new Error('invalid protocol')
    if (!proxy) throw new Error('invalid protocol')

    this._proxies.set(protocol, proxy)
  }

  open (name, callback) {
    const ctx = this

    if (!ctx._connections.has(name)) {
      throw new Error(`Can't find connection by name: ${name}`)
    }

    const conn = ctx._connections.get(name)

    // current connection has been opend, only return conn
    if (conn.IsOpened) {
      if (callback) {
        return callback(null, conn)
      }

      return Promise.resolve(conn)
    }

    // bind events
    const bindFunc = ctx._bindHandlers.bind(ctx)

    bindFunc(conn)

    return conn.open(callback)
  }

  close (name, callback) {
    const ctx = this

    if (!ctx._connections.has(name)) {
      throw new Error(`Can't find connection by name: ${name}`)
    }

    // bind events
    const removeFunc = ctx._removeHandlers.bind(ctx)
    const conn = ctx._connections.get(name)

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
    const ctx = this
    const conns = []
    const errs = {}

    for (const name of ctx._connections.keys()) {
      conns.push(name)
    }

    const pending = Promise.all(
      conns.map(
        (name) => ctx.
          open(name).
          catch((err) => {
            errs[name] = err

            return null
          })
        )
    )

    return ctx.
      _resolve(pending, callback, errs)
  }

  closeAll (callback) {
    const ctx = this
    const conns = []
    const errs = {}

    for (const conn of ctx._connections.keys()) {
      conns.push(conn)
    }

    const pending = Promise.all(
      conns.map(
        (name) => ctx.
          close(name).
          catch((err) => {
            errs[name] = err

            return null
          })
      )
    )

    return ctx.
      _resolve(pending, callback, errs)
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
    const ctx = this

    conn.on('error', ctx._errorHandler.bind(ctx))
    conn.on('open', ctx._openHandler.bind(ctx))
    conn.on('close', ctx._closeHandler.bind(ctx))
  }

  _removeHandlers (conn) {
    const ctx = this

    conn.removeListener('error', ctx._errorHandler.bind(ctx))
    conn.removeListener('open', ctx._openHandler.bind(ctx))
    conn.removeListener('close', ctx._closeHandler.bind(ctx))
  }

  _errorHandler (err, conn) {
    const ctx = this

    ctx.emit('error', err, conn.Name)
  }

  _createHandler (conn) {
    const ctx = this

    ctx.emit('create', conn.Name)
  }

  _openHandler (conn) {
    const ctx = this

    ctx.emit('open', conn.Name)
  }

  _closeHandler (conn) {
    const ctx = this

    ctx.emit('close', conn.Name)
  }

  _createErrors (errs) {
    const err = new Error('Issue for connections')

    err.details = errs

    return err
  }

}

module.exports = DbConnections

/*
  getConnectionKey (connectionString, options) {
    const sb = new StringBuilder()

    sb.append(connectionString)
    sb.append(connectionString.indexOf('?') > 0 ? '&' : '?')

    let first = true

    const getKeys = (obj, level) => {
      Object.
        keys(options).
        forEach((key) => {
          if (first === true) {
            first = false
          } else {
            sb.append('&')
          }

          if (typeof options[key] === 'object') {
            getKeys(options[key], level + 1)
          } else {
            if (level && level > 0) {
              sb.append(`${level}#`)
            }

            sb.append(`${key}=${options[key]}`)
          }
        })
    }

    getKeys(options, 0)

    return sb.toString()
  }
*/
