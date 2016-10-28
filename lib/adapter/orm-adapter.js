require('nblue')
const DbAdapter = require('./db-adapter')

class OrmDbAdapter extends DbAdapter
{

  constructor (schema, connection) {
    super(schema, connection)

    this._t = ''
  }

}

module.exports = OrmDbAdapter
