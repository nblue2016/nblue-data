require('nblue-core')

const SchemaCache = require('./schema-cache')
const DbAdapter = require('./dbadapter')
const DbConnections = require('./db-connections')
const DbProxy = require('./db-proxy')
const MongoDbProxy = require('./mongodb-proxy')
const MongoDbAdapter = require('./mongodb-adapter')
const MongooseProxy = require('./mongoose-proxy')
const MongooseDbAdapter = require('./mongoose-adapter')

const ConfigMap = global.ConfigMap

if (global.notSupportError) {
  global.notSupportError = function (method) {
    throw new Error(
      String.format(
        "The current %s wasn't supportted by abstract class.",
        method
      )
    )
  }
}

if (ConfigMap) {
  if (!ConfigMap.prototype.getConnectionString) {
    ConfigMap.prototype.getConnectionString = function (name) {
      const configDb =
        (this.get('connections') || new Map()).
          filter((item) => item.has(name))

      return configDb.length > 0 ? configDb[0].get(name) : null
    }
  }
}

const exported = {}

exported.name = 'data'
exported.SchemaCache = SchemaCache
exported.DbConnections = DbConnections
exported.DbProxy = DbProxy
exported.MongoDbProxy = MongoDbProxy
exported.MongooseProxy = MongooseProxy
exported.DbAdapter = DbAdapter
exported.MongoDbAdapter = MongoDbAdapter
exported.MongooseDbAdapter = MongooseDbAdapter

module.exports = exported
