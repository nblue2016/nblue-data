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
    const ctx = this
    const proxy = ctx._proxy

    return proxy.
      open(ctx._connectionString, ctx._options).
      then((data) => {
        ctx._instance = data

        // use callback function
        if (callback) {
          return callback(null, data)
        }

        // raise open event
        ctx.emit('open', ctx)

        // return a promise
        return Promise.resolve(data)
      }).
      catch((err) => {
        // use callback function
        if (callback) {
          return callback(err, null)
        }

        // raise error event
        ctx.emit('error', err, ctx)

        // return a promise
        return Promise.reject(err)
      })
  }

  close (callback) {
    const ctx = this
    const proxy = ctx._proxy

    return proxy.
      close(ctx._instance).
      then(() => {
        // use callback function
        if (callback) {
          return callback(null, ctx._instance)
        }

        // raise close event
        ctx.emit('close', ctx)

        // return a promise
        return Promise.resolve(ctx._instance)
      }).
      catch((err) => {
        // use callback function or return promise
        if (callback) {
          return callback(err, null)
        }

        // raise error event
        ctx.emit('error', err, ctx)

        // return a promise
        return Promise.reject(err)
      }).
      finally(() => {
        // clear instance
        ctx._instance = null
      })
  }

  getAdapter (schema, callback) {
    const ctx = this
    const proxy = ctx._proxy

    try {
      if (!schema) {
        throw new Error('Schema is null')
      }

      if (!ctx.IsOpened) {
        throw new Error(`Current connection wasn't opened.`)
      }

      const name = schema.name

      const pending = () => {
        if (ctx._adapters.has(name)) {
          return Promise.resolve(ctx._adapters.get(name))
        }

        let adapter = proxy.createAdapter(schema, ctx.Instance)

        if (!(adapter instanceof Promise)) {
          adapter = Promise.resolve(adapter)
        }

        return adapter.
          then((data) => {
            ctx._adapters.set(name, data)

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
          ctx.emit('error', err, ctx)

          return Promise.reject(err)
        })
    } catch (err) {
      if (callback) {
        return callback(err, null)
      }

      // raise error event
      ctx.emit('error', err, ctx)

      return Promise.reject(err)
    }
  }

}

module.exports = DbConnection
