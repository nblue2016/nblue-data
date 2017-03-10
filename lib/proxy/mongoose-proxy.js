
// use libraries
const DbProxy = require('./db-proxy')
const Adapter = require('.././adapter/mongoose-adapter')

class MongooseProxy extends DbProxy
{

  defaultOptions () {
    return {
      db: { native_parser: true },
      auth: { authDb: 'admin' },
      server: { poolSize: 10 }
    }
  }

  parseUrl (mongoUrl, options) {
    const that = this
    const dict = super.parseUrl(mongoUrl)

    if (dict.user &&
      !dict.options.authdb) {
      dict.options.authdb = dict.database
    }

    const opts = {}

    Object.assign(opts, that.defaultOptions())

    if (options) {
      Object.assign(opts, options)
    }

    // process specail keys in options
    Object.
      keys(dict.options).
      forEach((key) => {
        switch (key.toLowerCase()) {
        case 'authdb':
          if (!opts.auth) options.auth = {}

          opts.auth.authDb = dict.options[key]
          break
        default:
          opts[key] = dict.options[key]
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

    result.options = opts

    return result
  }

  open (connectionString, options) {
    // get class of Mongoose
    const Mongoose = require('mongoose')

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

  createAdapter (context, schema) {
    return new Adapter(context, schema)
  }

}

module.exports = MongooseProxy
