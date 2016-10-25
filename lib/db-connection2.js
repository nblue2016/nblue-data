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

  open (callback) {
    const ctx = this
    const proxy = ctx._proxy

    return proxy.
      open(ctx._connectionString, ctx._options).
      then((data) => {
        ctx._instance = data

        // raise open event
        ctx.emit('open', ctx)

        // use callback function or return promise
        if (callback) {
          return callback(null, data)
        }

        return Promise.resolve(data)
      }).
      catch((err) => {
        // raise error event
        ctx.emit('error', err, ctx)

        // use callback function or return promise
        if (callback) {
          return callback(err, null)
        }

        return Promise.reject(err)
      })
  }

  close (callback) {
    const ctx = this
    const proxy = ctx._proxy

    return proxy.
      close().
      then(() => {
        // raise close event
        ctx.emit('close', ctx)

        // use callback function or return promise
        if (callback) {
          return callback(null, ctx._instance)
        }

        return Promise.resolve(ctx._instance)
      }).
      catch((err) => {
        // raise error event
        ctx.emit('error', err, ctx)

        // use callback function or return promise
        if (callback) {
          return callback(err, null)
        }

        return Promise.reject(err)
      })
  }

  getAdapter (schema, callback) {
    const ctx = this

    try {
      if (!schema) {
        throw new Error('Schema is null')
      }

      if (!ctx._instance) {
        throw new Error(`The connections wasn't opened.`)
      }

      const name = schema.name

      const pending = () => {
        if (ctx._adapters.has(name)) {
          return Promise.resolve(ctx._adapters.get(name))
        }

        return ctx._proxy.
          createAdapter(schema, ctx._instance).
          then((data) => {
            ctx._adapters.set(name, data)

            return data
          })
      }

      return pending().
        then((data) => {
          if (callback) return callback(null, data)

          return data
        }).
        catch((err) => {
          if (callback) return callback(err, null)

          return Promise.reject(err)
        })
    } catch (err) {
      if (callback) return callback(err, null)

      return Promise.reject(err)
    }
  }

}

module.exports = DbConnection
