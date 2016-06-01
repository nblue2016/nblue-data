const url = require('url')
const DbConnection = require('db-connection')
const MongoDbProxy = require('mongodb-proxy')
const aq = global.aq

class DbConnections
{

  constructor () {
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

  create (name, connectionString, options) {
    const ctx = this
    const parsedUrl = url.parse(connectionString)
    const protocol = parsedUrl.protocol

    const proxy = ctx.getProxy(protocol)

    return ctx._create(proxy, name, connectionString, options, ctx)
  }

  createByUri (name, connectionUrl, caller) {
    const ctx = caller ? caller : this
    const parsedUrl = url.parse(connectionUrl)
    const protocol = parsedUrl.protocol

    const proxy = ctx.getProxy(protocol)

    const {
      connectionString: cs,
      options: opts
    } = proxy.parseUrl(connectionUrl)

    return ctx._create(proxy, name, cs, opts, ctx)
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
        map((item) => ctx.createByUri(item.name, item.connectionString, ctx))
    )
  }

  _create (proxy, name, connectionString, options, caller) {
    const ctx = caller ? caller : this

    return Promise(0).
      then(() => {
        const csCache = ctx.ConnectoinStringCache

        // get connection from cache if it was created before
        if (csCache.has(connectionString)) {
          return csCache.get(connectionString)
        }

        // create and open new connection by cs and options
        return proxy.open(connectionString, options)
      }).
      then((conn) => {
        const csCache = ctx.ConnectoinStringCache

        // insert opened connection into cache if there is no opned
        // connections by current string
        if (!csCache.has(connectionString)) {
          csCache.set(connectionString, conn)
        }

        // create new instance of db connection with current connection
        const dbConn = new DbConnection(name, connectionString, conn)

        // set properties of db connection
        dbConn.Connected = true
        dbConn.proxy = proxy

        // return
        return dbConn
      }).
      then((conn) => {
        const conns = ctx.Connections

        if (!conns.has(name)) {
          conns.set(name, conn)
        }

        return conn
      })
  }

  createAdapter (entityName) {
    const ctx = this
    const cache = ctx.EntityCache

    let conn = null

    if (cache.has(entityName)) {
      conn = cache.get(entityName)
    }

    if (conn === null ||
      conn.Proxy === null) {
      return null
    }

    const proxy = conn.Proxy

    return proxy.createAdapter(entityName, conn)
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

  close (name) {
    const ctx = this

    const conn = ctx.getByName(name)

    if (conn === null ||
       conn.Proxy === null) {
      return Promise(null)
    }

    if (!conn.Connected) {
      return Promise(conn.Connection)
    }

    const proxy = conn.Proxy

    return proxy.close(conn.Connection)
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
