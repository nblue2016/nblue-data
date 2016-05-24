require('nblue-core')

const SchemaCache = require('./schemacache')
const DbAdapter = require('./dbadapter')
const MongoDbConnection = require('./mongodbconnection')
const MongoDbConnections = require('./mongodbconnections')
const MongoDbAdapter = require('./mongodbadapter')

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
exported.DbAdapter = DbAdapter
exported.MongoDbConnection = MongoDbConnection
exported.MongoDbConnections = MongoDbConnections
exported.MongoDbAdapter = MongoDbAdapter

module.exports = exported
