require('nblue')
const DbAdapter = require('./db-adapter')

class OrmDbAdapter extends DbAdapter
{

  constructor (name, connection) {
    super(name, connection)

    this._t = ''
  }

}

module.exports = OrmDbAdapter
