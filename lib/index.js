require('nblue')

const Schemas = require('./schema/schemas')
const OrmBridge = require('./schema/orm-bridge')
const DbConnections = require('./db-connections')

const DbProxy = require('./proxy/db-proxy')
const DbAdapter = require('./adapter/db-adapter')

const MongoDbProxy = require('./proxy/mongodb-proxy')
const MongoDbAdapter = require('./adapter/mongodb-adapter')

const MongooseProxy = require('./proxy/mongoose-proxy')
const MongooseDbAdapter = require('./adapter/mongoose-adapter')

const OrmDbProxy = require('./proxy/orm-proxy')
const OrmDbAdapter = require('./adapter/orm-adapter')

const ValidatorError = require('./error/validator')

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
exported.DbAdapter = DbAdapter

exported.MongoDbProxy = MongoDbProxy
exported.MongoDbAdapter = MongoDbAdapter

exported.MongooseProxy = MongooseProxy
exported.MongooseDbAdapter = MongooseDbAdapter

exported.OrmDbProxy = OrmDbProxy
exported.OrmDbAdapter = OrmDbAdapter

exported.ValidatorError = ValidatorError


module.exports = exported
