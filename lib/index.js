require('nblue')

const Schemas = require('./schema/schemas')
const OrmBridge = require('./schema/orm-bridge')
const DbConnections = require('./db-connections')
const DbProxy = require('./proxy/db-proxy')
const MongoDbProxy = require('./proxy/mongodb-proxy')
const MongooseProxy = require('./proxy/mongoose-proxy')
const DbAdapter = require('./adapter/db-adapter')
const MongoDbAdapter = require('./adapter/mongodb-adapter')
const MongooseDbAdapter = require('./adapter/mongoose-adapter')

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
exported.Schemas = Schemas
exported.OrmBridge = OrmBridge
exported.DbConnections = DbConnections
exported.DbProxy = DbProxy
exported.MongoDbProxy = MongoDbProxy
exported.MongooseProxy = MongooseProxy
exported.DbAdapter = DbAdapter
exported.MongoDbAdapter = MongoDbAdapter
exported.MongooseDbAdapter = MongooseDbAdapter

module.exports = exported
