require('nblue-core')

if (global.NotSupportError) {
  global.NotSupportError = function (method)
  {
    throw new Error(String.forma("The current %s wasn't supportted by abstract class.", method))
  }
}

if (ConfigMap) {
  if (!ConfigMap.prototype.getConnectionString) {
    ConfigMap.prototype.getConnectionString = function (name) {

      const configDb = (this.get('connections') || new Map()).filter(item => item.has(name))
      return (configDb.length > 0) ? configDb[0].get(name) : null
    }
  }
}

module.exports = {
  "name": "data",
  "SchemaCache": require('./schemaCache.js'),
  "DbAdapter": require('./dbAdapter.js'),
  "MongoDBConnections": require('./mongoDBConnections.js'),
  "MongoDBAdapter": require('./mongoDBAdapter.js')
}
