class DbConnection {

  constructor (name, connectionString, connection) {
    this._name = name
    this._connectionString = connectionString
    this._connection = connection
    this._connected = false
    this._proxy = null
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

  get Proxy () {
    return this._proxy
  }
  set Proxy (val) {
    this._proxy = val
  }

}

module.exports = DbConnection
