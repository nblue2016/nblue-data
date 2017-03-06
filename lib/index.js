const core = require('nblue-core')

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

const ConfigMap = core.ConfigMap
const NotSupportError =
  (method) => {
    throw new Error(
      `The current ${method} wasn't supportted by abstract class.`
    )
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

const outputter = {}

outputter.name = 'data'
outputter.Schemas = Schemas
outputter.OrmBridge = OrmBridge
outputter.DbConnections = DbConnections
outputter.DbProxy = DbProxy
outputter.DbAdapter = DbAdapter

outputter.MongoDbProxy = MongoDbProxy
outputter.MongoDbAdapter = MongoDbAdapter

outputter.MongooseProxy = MongooseProxy
outputter.MongooseDbAdapter = MongooseDbAdapter

outputter.OrmDbProxy = OrmDbProxy
outputter.OrmDbAdapter = OrmDbAdapter
outputter.ValidatorError = ValidatorError
outputter.NotSupportError = NotSupportError


module.exports = outputter
