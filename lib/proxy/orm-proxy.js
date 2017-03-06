// use namespace
const core = require('nblue-core')

// use classes
const DbProxy = require('./db-proxy')
const Adapter = require('.././adapter/orm-adapter')
const StringBuilder = core.StringBuilder

class OrmDbProxy extends DbProxy
{

  static getModule () {
    try {
      return require('orm')
    } catch (err) {
      return null
    }
  }

  parseUrl (ormUrl, options) {
    const result = {}

    result.connectionString = ormUrl
    result.options = options

    return result
  }

  open (connectionString, options) {
    const orm = OrmDbProxy.getModule()

    if (orm === null) {
      // output warning message to user if there is no request or node-fetch
      const sb = new StringBuilder()

      sb.append('Can\'t find any orm module in current project, ')
      sb.append('you need install the module, like below\r\n')
      sb.append('npm install orm \r\n or \r\n')

      return Promise.reject(sb.toString())
    }

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
