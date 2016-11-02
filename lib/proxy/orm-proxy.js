const orm = require('orm')
const DbProxy = require('./db-proxy')
const Adapter = require('.././adapter/orm-adapter')

class OrmDbProxy extends DbProxy
{

  parseUrl (ormUrl, options) {
    const result = {}

    result.connectionString = ormUrl
    result.options = options

    return result
  }

  open (connectionString, options) {
    return new Promise((resolve, reject) => {
      orm.connect(
        connectionString,
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
    try {
      // create new instance of adapter
      const adapter = new Adapter(context, schema)

      return new Promise((resolve, reject) => {
        // define orm model with options
        const owner = context.define(
          adapter.Name, adapter.Model, adapter.Options
        )

        // sync orm model with database
        context.sync((err) => {
          if (err) return reject(err)

          // set owner to adapter
          adapter.Owner = owner

          // resovle adapter
          return resolve(adapter)
        })
      })
    } catch (err) {
      return Promise.reject(err)
    }
  }

}

module.exports = OrmDbProxy
