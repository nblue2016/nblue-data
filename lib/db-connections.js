// use namesace
const url = require('url')
const events = require('events')
const core = require('nblue-core')

// use classes
const EventEmitter = events.EventEmitter
const Schemas = require('./schema/schemas')
const DbConnection = require('./db-connection')
const MongoDbProxy = require('./proxy/mongodb-proxy')
const MongooseDbProxy = require('./proxy/mongoose-proxy')
const OrmDbProxy = require('./proxy/orm-proxy')

const co = core.co
const IIf = core.IIf

// define constrants
const EVENT_OF_ERROR = 'error'
const EVENT_OF_CREATE = 'create'
const EVENT_OF_OPEN = 'open'
const EVENT_OF_CLOSE = 'close'

const ERROR_MESSAGE_FOR_OPENALL = 'Some issues occur during open connections'
const ERROR_MESSAGE_FOR_CLOSEALL = 'Some issues occur during close connections'

const CONFIG_KEY_OF_DATABASE = 'database'
const CONFIG_KEY_OF_CONNECTIONS = 'connections'
const CONFIG_KEY_OF_PROXIES = 'proxies'

const DefaultProxies = new Map().
  set('mongodb:', new MongoDbProxy()).
  set('mysql:', new OrmDbProxy()).
  set('sqlite:', new OrmDbProxy())

class DbConnections extends EventEmitter
{

  constructor (schemas) {
    // call super constructor
    super()

    // init private variants
    this._schemas = schemas ? schemas : Schemas.create()

    this._proxies = new Map()
    this._connections = new Map()

    for (const [protocol, proxy] of DefaultProxies) {
      // register default proxies
      this.registerProxy(protocol, proxy)
    }
  }

  get Schemas () {
    return this._schemas
  }

  get Proxies () {
    return this._proxies
  }

  getConnection (name) {
    // throw error if can't find connection by name
    if (!this._connections.has(name)) {
      throw new Error(`The connection(${name}) wasn't created.`)
    }

    // return instance of connection by name
    return this._connections.get(name)
  }

  createConnection (name) {
    // get connection by name
    const conn = this.getConnection(name)

    // throw error if can't get connection by name
    if (!conn) {
      throw new Error(
        `can't created connection for ${name}, please sure it was registered`
      )
    }

    // return cloned info of connection
    return conn.clone()
  }

  getConnectionByModel (model) {
    // get instance of schemas
    const schemas = this.Schemas

    // get instance of schema by model name
    const schema = schemas.Schema(model)

    // throw error if can't find schema by name
    if (!schema) {
      throw new Error(`can't find schema by name :${model}`)
    }

    // get database name from schema
    const database = schema.database || null

    // throw error if can't find database name
    if (!database) {
      throw new Error(`can't find database for schema (${model}).`)
    }

    // return connection by database name
    return this.getConnection(database)
  }

  create (name, connectionString, options) {
    // create new connection with arguments
    return this.registerConnection(
      name,
      connectionString,
      options || {}
    )
  }

  getConnectionStringFromConfig (config, name) {
    // check for arguments
    if (!config) throw new ReferenceError('config')
    if (!name) throw new ReferenceError('name')

    // get connection strings config section
    const cssMap = this.getConfigValues(config, CONFIG_KEY_OF_CONNECTIONS)

    // check name in config
    if (!cssMap.has(name)) {
      throw new Error(`can't find connection name in config.`)
    }

    // get connection string by name
    return cssMap.get(name)
  }

  createByConfig (config, name) {
    // get connection string from config by name
    const cs = this.getConnectionStringFromConfig(config, name)

    // create connection with name and connection string
    return this.create(name, cs)
  }

  createByConfigs (config) {
    // check for argument
    if (!config) throw new ReferenceError('config')

    // get connection strings config section
    const cssMap = this.getConfigValues(config, CONFIG_KEY_OF_CONNECTIONS)

    // fetch every item in map
    for (const [name, cs] of cssMap) {
      // ignore if current protocol of connection string wasn't supported
      if (!this.support(cs)) continue

      // create connection with name and connection string
      this.create(name, cs)
    }
  }

  getConfigValues (config, type) {
    // check for arguments
    if (!config) throw new ReferenceError('config')
    if (!type) throw new ReferenceError('type')

    // get database section of config
    const dbMap =
      config.has(CONFIG_KEY_OF_DATABASE)
      ? config.get(CONFIG_KEY_OF_DATABASE)
      : new Map()

    if (type === CONFIG_KEY_OF_DATABASE) return dbMap

    // get connections section from config
    const cssMap =
      dbMap.has(CONFIG_KEY_OF_CONNECTIONS)
      ? dbMap.get(CONFIG_KEY_OF_CONNECTIONS)
      : new Map()

    if (type === CONFIG_KEY_OF_CONNECTIONS) return cssMap

    // get proxies section from config
    const psMap =
      dbMap.has(CONFIG_KEY_OF_PROXIES)
      ? dbMap.get(CONFIG_KEY_OF_PROXIES)
      : new Map()

    if (type === CONFIG_KEY_OF_PROXIES) return psMap

    // return empty map
    return new Map()
  }

  registerConnection (name, connectionString, options) {
    // check arguments
    if (!name) throw new ReferenceError('name')
    if (!connectionString) throw new ReferenceError('connectionString')

    // throw error if current name was registered already
    if (this._connections.has(name)) {
      throw new Error('Current name:${name} has been registered!')
    }

    // parse connection string
    const parsedUrl = url.parse(connectionString)

    // check protocol was registered or not
    if (!this._proxies.has(parsedUrl.protocol)) {
      throw new Error(`Doesn't support protocol: ${parsedUrl.protocol}`)
    }

    // get proxy by protocol
    const proxy = this._proxies.get(parsedUrl.protocol)

    // declare opts
    const opts = {}

    // assign options to opts
    if (typeof options === 'function') {
      Object.assign(opts, options())
    } else if (typeof options === 'object') {
      Object.assign(opts, options)
    }

    // create connection through proxy by connectoin string with options
    const conn = proxy.createConnection(connectionString, opts)

    // set name of connection
    if (!conn.Name) conn.Name = name

    // append connection to cache by name
    this._connections.set(name, conn)

    // emit create event
    this.emit(EVENT_OF_CREATE, name)

    // return instance of connection
    return conn
  }

  registerProxy (protocol, proxy) {
    // check argumetns
    if (!protocol) throw new ReferenceError('protocol')
    if (!proxy) throw new ReferenceError('proxy')

    // save proxy to cache by protocol
    this._proxies.set(
      protocol.endsWith(':') ? protocol : `${protocol}:`,
      proxy)
  }

  open (name, callback) {
    // check for argument
    if (!name) throw new ReferenceError('name')

    // throw error if connection name was regiestered
    if (!this._connections.has(name)) {
      throw new Error(`Can't find connection by name: ${name}`)
    }

    // get connection from cache
    const conn = this._connections.get(name)

    // current connection has been opend, only return conn
    if (conn.IsOpened) {
      return callback ? callback(null, conn) : Promise.resolve(conn)
    }

    // bind events for connection
    this._bindHandlers(conn)

    // return opened connection
    return conn.open(callback)
  }

  close (name, callback) {
    // check for argument
    if (!name) throw new ReferenceError('name')

    // throw error if current name wasn't registered
    if (!this._connections.has(name)) {
      throw new Error(`Can't find connection by name: ${name}`)
    }

    // define function for remove connection events
    const removeFunc = this._removeHandlers.bind(this)

    // get instance of connection from cache
    const conn = this._connections.get(name)

    // declare close callback function
    let cb = null

    // set close callback function
    if (callback) {
      cb = function (err, data) {
        // remove events of connection
        removeFunc(conn)

        // invoke callback function
        return callback(err, data)
      }
    }

    // return connection if it has been closed already
    if (!conn.IsOpened) {
      return cb ? cb(null, conn) : Promise.resolve(conn)
    }

    // call close method
    return conn.
      close(cb).
      finally(() => {
        if (!cb) removeFunc(conn)
      })
  }

  openAll (callback) {
    return this.workAll({
      method: 'open',
      errorMessage: ERROR_MESSAGE_FOR_OPENALL,
      callback
    })
  }

  closeAll (callback) {
    return this.workAll({
      method: 'close',
      errorMessage: ERROR_MESSAGE_FOR_CLOSEALL,
      callback
    })
  }

  workAll (options) {
    // assign this to that
    const that = this

    // assign options to opts
    const opts = options || {}

    // get instance of registered connections
    const conns = this._connections

    const workFunc = this[opts.method].bind(this)

    // create a genreator function
    const gen = function *() {
      // declare variants
      const rt = []
      const errs = new Map()

      // fetch every name in registered connections
      for (const name of conns.keys()) {
        try {
          rt.push(yield workFunc(name))
        } catch (err2) {
          errs.set(name, err2)
        }
      }

      // generate an error by map of errors and message
      const err = IIf(errs.size === 0, null, new Error(opts.errorMessage))

      // append errors to new error details
      if (err) err.details = errs.toObject()

      // process callback function
      if (opts.callback) return opts.callback(err, rt)

      // return result with a promise
      return err ? Promise.reject(err) : Promise.resolve(rt)
    }

    // execute generator function to get a Promise
    return co(gen)
  }

  getAdapter (model, callback) {
    // check argument
    if (!model) throw new ReferenceError('model')

    // get instance of schemas
    const schemas = this.Schemas

    // define function for open connection
    const openFunc = this.open.bind(this)

    // return a Promise for result
    return co(function *() {
      // get schema by model name
      const schema = schemas.Schema(model)

      // get database name from schema
      const name = schema.database

      // get connection by database name
      const conn = yield openFunc(name)

      // check opened connection
      if (!conn || !conn.IsOpened) {
        throw new Error(`open connection failed for db: ${name}`)
      }

      // retun adapter by schema
      return yield conn.getAdapter(schema, callback)
    })
  }

  support (connectionString) {
    // check for argument
    if (!connectionString) throw new ReferenceError('connectionString')

    // parse connection string
    const parsedUrl = url.parse(connectionString)

    // return support protocol or not
    return this.supportProtocol(parsedUrl.protocol)
  }

  supportProtocol (protocol) {
    // check for argument
    if (!protocol) throw new ReferenceError('protocol')

    // return protocol was registered in proxies or not
    return this._proxies.has(
      protocol.endsWith(':') ? protocol : `${protocol}:`
    )
  }

  static getDefaultProxies () {
    return new Map(DefaultProxies)
  }

  static getPackages (options) {
    // assign options to opts
    const opts = options || {}
    // declare a set for need packages
    const packages = new Set()

    // get instance of config
    const config = opts.config || null

    // get instance of proxies
    const proxies = opts.proxies || DefaultProxies

    // define function get package name by protocol
    const getPackageByProtocol = (protocol) => {
      switch (protocol) {
      case 'mongodb:':
        return 'mongodb'
      case 'mysql:':
        return 'mysql'
      case 'sqlite:':
        return 'sqlite3'
      default:
        return null
      }
    }

    // define function get package name by proxy
    const getPackageByProxy = (proxy) => {
      if (proxy instanceof MongoDbProxy) {
        return 'mongodb'
      } else if (proxy instanceof MongooseDbProxy) {
        return 'mongoose'
      } else if (proxy instanceof OrmDbProxy) {
        return 'orm'
      } else if (proxy &&
              proxy.getPackages &&
              typeof proxy.getPackages === 'function') {
          // get packages from proxy
        const aryVal = proxy.getPackages(config)

          // append every package to set
        if (aryVal) aryVal.forEach((item) => packages.add(item))
      }

      return null
    }

    // declare
    let name = null

    // try to get need packages through config if find runtime config
    if (config && config instanceof Map) {
      // get config seciont for database
      const dbMap = config.get(CONFIG_KEY_OF_DATABASE) || new Map()

      // get config section for connections
      const cssMap = dbMap.get(CONFIG_KEY_OF_CONNECTIONS) || new Map()

      // fetch every config
      for (const cs of cssMap.values()) {
        // get protocol by connection string
        const protocol = url.parse(cs).protocol

        // get package name by protocol
        name = getPackageByProtocol(protocol)

        // add name to packages if it was found
        if (name) packages.add(name)

        // try to get packages if find proxy by protocol
        if (proxies.has(protocol)) {
          // get package name by proxy
          name = getPackageByProxy(proxies.get(protocol))

          // add name to packages if it was found
          if (name) packages.add(name)
        }
      }
    } else {
      // otherwise find packages by registered
      for (const protocol of proxies.keys()) {
        // get package name by protocol
        name = getPackageByProtocol(protocol)

        // add name to packages if it was found
        if (name) packages.add(name)
      }

      // otherwise find packages by registered
      for (const proxy of proxies.values()) {
        // get package name by proxy
        name = getPackageByProxy(proxy)

        // add name to packages if it was found
        if (name) packages.add(name)
      }
    }

      // convert set to array and return
    return Array.from(packages)
  }

  _bindHandlers (conn) {
    // check for argument
    if (!conn) throw new ReferenceError('conn')

    // bind events
    conn.on('error', this._errorHandler.bind(this))
    conn.on('open', this._openHandler.bind(this))
    conn.on('close', this._closeHandler.bind(this))
  }

  _removeHandlers (conn) {
    // check for argument
    if (!conn) throw new ReferenceError('conn')

    // remove events
    conn.removeListener('error', this._errorHandler.bind(this))
    conn.removeListener('open', this._openHandler.bind(this))
    conn.removeListener('close', this._closeHandler.bind(this))
  }

  _errorHandler (err, conn) {
    // emit error event
    this.emit(EVENT_OF_ERROR, err, conn.Name)
  }

  _createHandler (conn) {
    // emit create event
    this.emit(EVENT_OF_CREATE, conn.Name)
  }

  _openHandler (conn) {
    // emit open event
    this.emit(EVENT_OF_OPEN, conn.Name)
  }

  _closeHandler (conn) {
    // emit close event
    this.emit(EVENT_OF_CLOSE, conn.Name)
  }

  _createErrors (errs) {
    // create new instance of error
    const err = new Error('Issue for connections')

    // append errors to details
    err.details = errs

    // return new error
    return err
  }

}

module.exports = DbConnections
