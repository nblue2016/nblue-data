require('nblue-core')

if (global.NotSupportError) {
  global.NotSupportError = function (method)
  {
    throw new Error(String.forma("The current %s wasn't supportted by abstract class.", method))
  }
}

module.exports = {
  "name": "data",
  "SchemaCache": require('./schemaCache.js'),
  "DbAdapter": require('./dbAdapter.js'),
  //"MongoDBConnections": require('./mongoDBConnections.js'),
  //"MongoDBAdapter": require('./mongoDBAdapter.js')
}
