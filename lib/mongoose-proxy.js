const Mongoose = require('mongoose')
const DbProxy = require('./db-proxy')
const Adapter = require('./mongoose-adapter')

class MongooseProxy extends DbProxy
{

  defaultOptions () {
    return {
      db: { native_parser: true },
      auth: { authDb: 'admin' },
      server: { poolSize: 10 }
    }
  }

  parseUrl (mongoUrl) {
    const ctx = this
    const dict = super.parseUrl(mongoUrl)

    if (dict.user &&
      !dict.options.authdb) {
      dict.options.authdb = dict.database
    }

    const options = {}

    Object.assign(options, ctx.defaultOptions())

    // process specail keys in options
    Object.
      keys(dict.options).
      forEach((key) => {
        switch (key.toLowerCase()) {
        case 'authdb':
          if (!options.auth) options.auth = {}

          options.auth.authDb = dict.options[key]
          break
        default:
          options[key] = dict.options[key]
          break
        }
      })


    const result = {}

    if (dict.user) {
      result.connectionString =
        String.format(
          'mongodb://${user}:${password}@${host}/${database}', dict)
    } else {
      result.connectionString =
        String.format(
          'mongodb://${host}/${database}', dict)
    }

    result.options = options

    return result
  }

  open (connectionString, options) {
    return new Promise((resolve, reject) => {
      const conn = Mongoose.
        createConnection(connectionString, options)

      conn.on('open', () => null)

      conn.on('connected', () => resolve(conn))

      conn.on('error', (err) => {
        conn.close()

        reject(err)
      })
    })
  }

  close (conn) {
    return new Promise((resolve, reject) => {
      conn.close()

      conn.on('disconnected', () => null)

      conn.on('close', () => resolve(conn))

      conn.on('error', (err) => reject(err))
    })
  }

  createAdapter (name, context) {
    return new Adapter(name, context)
  }

}

module.exports = MongooseProxy