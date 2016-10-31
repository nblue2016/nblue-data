const EventEmitter = require('events').EventEmitter

class DbConnection extends EventEmitter {

  constructor (proxy) {
    super()

    if (!proxy) {
      throw new Error('Can\'t find instance of proxy.')
    }

    this._proxy = proxy
    this._adapters = new Map()
    this._instance = null
  }

  get Name () {
    return this._name
  }
  set Name (val) {
    this._name = val
  }

  set ConnectionString (val) {
    this._connectionString = val
  }

  set Options (val) {
    this._options = val
  }

  get Instance () {
    return this._instance
  }

  get IsOpened () {
    return this._instance !== null
  }

  open (callback) {
    const that = this
    const proxy = that._proxy

    return proxy.
      open(that._connectionString, that._options).
      then((data) => {
        that._instance = data

        // use callback function
        if (callback) {
          return callback(null, data)
        }

        // raise open event
        that.emit('open', that)

        // return a promise
        return Promise.resolve(data)
      }).
      catch((err) => {
        // use callback function
        if (callback) {
          return callback(err, null)
        }

        // raise error event
        that.emit('error', err, that)

        // return a promise
        return Promise.reject(err)
      })
  }

  close (callback) {
    const that = this
    const proxy = that._proxy

    return proxy.
      close(that._instance).
      then(() => {
        // use callback function
        if (callback) {
          return callback(null, that._instance)
        }

        // raise close event
        that.emit('close', that)

        // return a promise
        return Promise.resolve(that._instance)
      }).
      catch((err) => {
        // use callback function or return promise
        if (callback) {
          return callback(err, null)
        }

        // raise error event
        that.emit('error', err, that)

        // return a promise
        return Promise.reject(err)
      }).
      finally(() => {
        // clear instance
        that._instance = null
      })
  }

  getAdapter (schema, callback) {
    const that = this
    const proxy = that._proxy

    try {
      if (!schema) {
        throw new Error('Schema is null')
      }

      if (!that.IsOpened) {
        throw new Error(`Current connection wasn't opened.`)
      }

      const name = schema.name

      const pending = () => {
        if (that._adapters.has(name)) {
          return Promise.resolve(that._adapters.get(name))
        }

        let adapter = proxy.createAdapter(schema, that.Instance)

        if (!(adapter instanceof Promise)) {
          adapter = Promise.resolve(adapter)
        }

        return adapter.
          then((data) => {
            that._adapters.set(name, data)

            return data
          })
      }

      return pending().
        then((data) => {
          if (callback) {
            return callback(null, data)
          }

          return Promise.resolve(data)
        }).
        catch((err) => {
          if (callback) {
            return callback(err, null)
          }

          // raise error event
          that.emit('error', err, that)

          return Promise.reject(err)
        })
    } catch (err) {
      if (callback) {
        return callback(err, null)
      }

      // raise error event
      that.emit('error', err, that)

      return Promise.reject(err)
    }
  }

}

module.exports = DbConnection
