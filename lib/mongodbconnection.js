class MongoDBConnection {

  constructor (name, connectionString, connection) {
    this._name = name
    this._connectionString = connectionString
    this._connection = connection
    this._connected = false
  }

  get Name () {
    return this._name
  }

  get ConnectionString () {
    return this._connectionString
  }

  get Connection () {
    return this._connection
  }

  get Connected () {
    return this._connected
  }
  set Connected (val) {
    this._connected = val
  }

}

module.exports = MongoDBConnection
