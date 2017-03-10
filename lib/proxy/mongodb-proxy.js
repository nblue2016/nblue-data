// use libraries
const DbProxy = require('./db-proxy')
const Adapter = require('.././adapter/mongodb-adapter')

class MongoDbProxy extends DbProxy
{

  defaultOptions () {
    return {
      authSource: 'admin'
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
          opts.authSource = dict.options[key]
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
    // get class of MongoDb
    const mongodb = require('mongodb')

    // get instance of mongo client
    const MongoClient = mongodb.MongoClient

    return new Promise((resolve, reject) => {
      MongoClient.connect(
        connectionString,
        options,
        (err, conn) => {
          if (err) {
            reject(err)
          } else {
            resolve(conn)
          }
        }
      )
    })
  }

  close (conn) {
    return new Promise((resolve, reject) => {
      conn.close((err) => {
        if (err) {
          reject(err)
        } else {
          resolve(conn)
        }
      })
    })
  }

  createAdapter (context, schema) {
    return new Adapter(context, schema)
  }

}

module.exports = MongoDbProxy
