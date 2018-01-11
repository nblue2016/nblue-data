// use namesace
const events = require('events')
const core = require('nblue-core')

// use classes
const EventEmitter = events.EventEmitter
const aq = core.aq
const co = core.co

class DbConnection extends EventEmitter {

  constructor (proxy) {
    // check argument
    if (!proxy) ReferenceError('proxy')

    // call super constructor
    super()

    // init variants
    this._proxy = proxy
    this._adapters = new Map()
    this._native = null
  }

  get Name () {
    return this._name
  }
  set Name (val) {
    this._name = val
  }

  get ConnectionString () {
    return this._connectionString
  }
  set ConnectionString (val) {
    this._connectionString = val
  }

  get Options () {
    return this._options
  }
  set Options (val) {
    this._options = val
  }

  get Native () {
    return this._native
  }

  get IsOpened () {
    return this._native !== null
  }

  open (callback) {
    // assign this to that
    const that = this

    // get instance of proxye
    const proxy = this._proxy

    // get connection string and options
    const connectionString = this.ConnectionString
    const opts = this.Options

    // clear current native connection
    this._native = null

    // return a Promise with generator function
    return co(function *() {
      // try to open native connection
      const conn = yield aq.then(proxy.open(connectionString, opts))

      // set native connection to current instance
      that._native = conn

      // raise open event
      that.emit('open', that)

      // return result
      return callback ? callback(null, conn) : conn
    }).
      catch((err) => {
        // raise error event
        that.emit('error', err, that)

        // return result for error
        return callback ? callback(err, null) : Promise.reject(err)
      })
  }

  close (callback) {
    // assign this to that
    const that = this

    // get instance of proxye
    const proxy = this._proxy

    // get native connection
    const nativeIns = this._native

    // get instance of adapters cache
    const adapters = this._adapters

    // return a Promise with generator function
    return co(function *() {
      // try to close native connection
      yield aq.then(proxy.close(nativeIns))

      // raise close event
      that.emit('close', that)

      // return result
      return callback ? callback(null, nativeIns) : nativeIns
    }).
      catch((err) => {
        // raise error event
        that.emit('error', err, that)

        // return result for error
        return callback ? callback(err, null) : Promise.reject(err)
      }).
      finally(() => {
        // set native connection to null
        if (that._native) that._native = null

        // clear all adapters in cache
        adapters.clear()
      })
  }

  getAdapter (schema, callback) {
    // assign this to that
    const that = this

    // get current proxy
    const proxy = this._proxy

    // check for argument
    if (!schema) throw new ReferenceError('schema')

    if (!this.IsOpened) {
      // current connection has already closed
      throw new Error(`Current connection wasn't opened.`)
    }

    // get adapter name from schema
    const name = schema.name

    // get instance of adapters cache
    const adapters = this._adapters

    // set native instance of connection
    const instance = this._native

    // return a Promise with generator function
    return co(function *() {
      // get instance of adapter
      const adapter = yield aq.then(
        adapters.has(name)
          ? adapters.get(name)
          : proxy.createAdapter(instance, schema)
      )

      // if it was closed, remove it
      if (adapter._native) {
        adapter._native = instance
      }

      // save adapter to cache
      adapters.set(name, adapter)

      // return result
      return callback ? callback(null, adapter) : adapter
    }).
      catch((err) => {
        // raise error event
        that.emit('error', err, that)

        // return result for error
        return callback ? callback(err, null) : Promise.reject(err)
      })
  }

  clone () {
    // create new instance of connection by current proxy
    const conn = new DbConnection(this._proxy)

    // copy properties to new instance
    conn.Name = this._name
    conn.ConnectionString = this._connectionString

    // return new instance of connection
    return conn
  }

}

module.exports = DbConnection
