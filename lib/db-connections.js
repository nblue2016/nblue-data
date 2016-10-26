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

    return conn
  }

  registerProxy (protocol, proxy) {
    if (!protocol) throw new Error('invalid protocol')
    if (!proxy) throw new Error('invalid protocol')

    this._proxies.set(protocol, proxy)
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
