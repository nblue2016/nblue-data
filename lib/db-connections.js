const url = require('url')
const EventEmitter = require('events').EventEmitter

const SchemaCache = require('./schema-cache')
const DbConnection = require('./db-connection')
const MongoDbProxy = require('./mongodb-proxy')

const aq = global.aq

class DbConnections extends EventEmitter
{

  constructor () {
    super()

    this._schemas = SchemaCache.create()

    this._proxies = new Map()
    this._connections = new Map()
    this._csCache = new Map()
    this._entityCache = new Map()

    this.registerProxy('mongodb:', new MongoDbProxy())
  }

  get Proxies () {
    return this._proxies
  }

  get Connections () {
    return this._connections
  }

  get ConnectoinStringCache () {
    return this._csCache
  }

  get EntityCache () {
    return this._entityCache
  }

  get Schemas () {
    return this._schemas
  }

  create (name, connectionString, options, callback) {
    const ctx = this
    const parsedUrl = url.parse(connectionString)
    const protocol = parsedUrl.protocol

    const opts = {}

    if (typeof options === 'function') {
      opts.callback = options
    } else if (typeof options === 'object') {
      Object.assign(opts, options)
    }

    if (callback) {
      opts.callback = callback
    }

    opts.proxy = ctx.getProxy(protocol)

    return ctx._create(name, connectionString, opts)
  }

  createByUri (name, connectionUrl, callback) {
    const ctx = this
    const parsedUrl = url.parse(connectionUrl)
    const protocol = parsedUrl.protocol

    const proxy = ctx.getProxy(protocol)

    const {
      connectionString: cs,
      options: opts
    } = proxy.parseUrl(connectionUrl)

    opts.caller = ctx
    opts.proxy = proxy
    opts.callback = callback

    return ctx._create(name, cs, opts)
  }

  createByConfig (name, config) {
    const ctx = this
    const dbUrl = config.getConnectionString(name)

    return ctx.createByUri(name, dbUrl)
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

    if (items.length === 0) {
      return Promise.resolve([])
    }

    return aq.parallel(
      items.
        filter((item) => item.connectionString).
        map((item) => ctx.
            createByUri(item.name, item.connectionString).
            then((conn) => Promise.resolve(conn)).
            catch(() => Promise.resolve(null))
        )
    )
  }

  _create (name, connectionString, options) {
    const ctx = options.caller ? options.caller : this
    const callback = options.callback ? options.callback : null
    const proxy = options.proxy ? options.proxy : null

    if (options.caller) Reflect.deleteProperty(options, 'caller')
    if (options.callback) Reflect.deleteProperty(options, 'callback')
    if (options.proxy) Reflect.deleteProperty(options, 'proxy')

    // get connection string cache
    const csCache = ctx.ConnectoinStringCache

    return Promise.resolve(0).
      then(() => {
        ctx.emit('open', name)

        // get connection from cache if it was created before
        if (csCache.has(connectionString)) {
          return csCache.get(connectionString)
        }

        // check instance of proxy
        if (proxy === null) throw new Error('Null reference of proxy.')

        // create and open new connection by cs and options
        return proxy.open(connectionString, options)
      }).
      then((conn) => {
        // create new instance of db connection with current connection
        const dbConn = new DbConnection(name, connectionString, conn)

        // set properties of db connection
        dbConn.Connected = true
        dbConn.Proxy = proxy

        // insert opened connection into cache if there is no opned
        // connections by current string
        if (!csCache.has(connectionString)) {
          csCache.set(connectionString, conn)

          ctx.emit('connected', name)
        }

        // return
        return dbConn
      }).
      then((conn) => {
        const conns = ctx.Connections

        if (!conns.has(name)) {
          conns.set(name, conn)
        }

        if (callback) {
          return callback(null, conn)
        }

        return conn
      }).
      catch((err) => {
        ctx.emit('error', err)

        if (callback) {
          return callback(err)
        }

        return Promise.reject(err)
      })
  }

  createAdapter (entityName) {
    const ctx = this
    const cache = ctx.EntityCache
    const schemas = ctx.Schemas

    let
      conn = null,
      schema = null

    if (cache.has(entityName)) {
      conn = cache.get(entityName)
    }

    if (conn === null) {
      schema = schemas.getSchema(entityName)
      const name = schema.database

      if (name) {
        conn = ctx.getByName(name)
        if (conn) cache.set(name, conn)
      }
    }

    if (conn === null ||
      conn.Proxy === null) {
      return null
    }

    // get proxy
    const proxy = conn.Proxy

    // create adapter by name
    const adapter = proxy.createAdapter(entityName, ctx)

    // find wrapper for current entity by name
    const wrapper = schemas.getWrapper(entityName)

    if (wrapper !== null) {
      const target = {}

      Object.assign(target, wrapper)
      target.name = entityName

      adapter.getWrapper = () => target
    }


    // return adapter
    return adapter
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

  close (name, callback) {
    const ctx = this

    const conn = ctx.getByName(name)

    if (conn === null ||
       conn.Proxy === null) {
      return Promise.resolve(null)
    }

    if (!conn.Connected) {
      return Promise.resolve(conn.Connection)
    }

    const proxy = conn.Proxy

    return Promise.
      resolve(0).
      then(() => {
        if (conn.Connected) {
          ctx.emit('close', name)

          return proxy.close(conn.Connection)
        }

        return null
      }).
      then((data) => {
        if (data === null) return null

        if (conn.Connected) {
          ctx.emit('disconnected', name)

          conn.Connected = false

          ctx.disconnectRelations(conn.ConnectionString)
        }

        if (callback) {
          return callback(null, conn)
        }

        return conn
      }).
      catch((err) => {
        ctx.emit('error', err)

        if (callback) {
          return callback(err)
        }

        return Promise.reject(err)
      })
  }

  closeAll () {
    const ctx = this
    const conns = ctx.Connections

    return aq.parallel(
      Array.
        from(conns.keys()).
        map((name) => ctx.close(name))
    )
  }

  disconnectRelations (connectionString) {
    const ctx = this
    const conns = ctx.Connections

    for (const conn of conns.values()) {
      if (conn.ConnectionString ===
          connectionString && conn.Connected) {
        conn.Connected = false
      }
    }
  }

  registerProxy (protocol, proxy) {
    if (!protocol) throw new Error('invalid protocol')
    if (!proxy) throw new Error('invalid protocol')

    const ctx = this
    const proxies = ctx._proxies

    proxies.set(protocol, proxy)
  }

  getProxy (protocol, caller) {
    const ctx = caller ? caller : this
    const proxies = ctx._proxies

    if (!proxies.has(protocol)) {
      throw new Error(`Doesn't support protocol: ${protocol}`)
    }

    return proxies.get(protocol)
  }

  getProxyByName (name) {
    const ctx = this

    const conn = ctx.getByName(name)

    if (conn === null) return null

    return conn.Proxy
  }

}

module.exports = DbConnections
