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

    // const key = ctx.getConnectionKey(connectionString, opts)
    // const conn = new DbConnection()
    const conn = proxy.createConnection(connectionString, opts)

    // append connection to cache
    ctx._connections.add(name, conn)

    return conn
  }

  registerProxy (protocol, proxy) {
    if (!protocol) throw new Error('invalid protocol')
    if (!proxy) throw new Error('invalid protocol')

    this._proxies.set(protocol, proxy)
  }

}

module.exports = DbConnections
