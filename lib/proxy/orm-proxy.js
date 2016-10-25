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

  createAdapter (name, context) {
    return new Adapter(name, context)
  }

}

module.exports = OrmDbProxy
