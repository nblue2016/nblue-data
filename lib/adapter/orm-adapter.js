// import libs
const nblue = require('nblue')

const aq = nblue.aq
const co = nblue.co

const DbAdapter = require('./db-adapter')
const OrmBridge = require('.././schema/orm-bridge')

class OrmDbAdapter extends DbAdapter
{

  constructor (connection, schema) {
    super(connection, schema)

    this._owner = null
    this._ormSchema = this.getOrmSchema(schema)
  }

  get Owner () {
    return this._owner
  }
  set Owner (val) {
    this._owner = val
  }

  get OrmSchema () {
    return this._ormSchema
  }

  get Model () {
    return this.OrmSchema.model
  }

  get Options () {
    return this.OrmSchema.options
  }


  getOrmSchema (schema) {
    return OrmBridge.toORMFullModel(schema)
  }

  _create (body, options) {
    const that = this

    const createFunc = that.Owner.create

    if (options && options.multi) {
      const opts = {}

      Object.assign(opts, options)
      Reflect.deleteProperty(opts, 'multi')

      return aq.parallel(
        body.map((item) => that._create(item, opts))
      )
    }

    return aq.callback((cb) => createFunc(body, cb))
  }

  _retrieve (filter, options) {
    const that = this

    const methodName = options && options.method ? options.method : 'find'
    const retrieveFunc = that.Owner[methodName]

    const opts = {}

    if (options.limit) opts.limit = options.limit
    if (options.top) opts.limit = options.top
    if (options.order) opts.order = options.order
    if (options.groupBy) opts.order = options.groupBy

    if (methodName === 'find') {
      return aq.callback((cb) => retrieveFunc(filter, opts, cb))
    }

    return aq.callback((cb) => retrieveFunc(filter, cb))
  }

  _update (filter, modifier, options) {
    const that = this

    return co(function *() {
      const data = yield that.retrieve(filter)

      const rt = yield aq.parallel(
        data.map(
          (item) => {
            Object.
              keys(modifier).
              forEach((key) => {
                item[key] = modifier[key]
              })

            return aq.callback((cb) => item.save(cb)).
              then(() => 1).
              catch(() => 0)
          }
        )
      )

      return rt
    })
  }

  _delete (filter, options) {
    const that = this

    return co(function *() {
      const data = yield that.retrieve(filter)

      const rt = yield aq.parallel(
        data.map(
          (item) =>
            aq.callback((cb) => item.remove(cb)).
            then(() => 1).
            catch(() => 0)
        )
      )

      return rt
    })
  }

  _getAfter (operation, caller) {
    // keep to use it in the future
    const that = this

    let afterFunc = null

    switch (operation) {
    case 'create':
    case 'retrieve':
      afterFunc = (data) => that._fetchData(data)
      break
    case 'update':
    case 'delete':
      afterFunc = (data) => {
        const ok = data && Array.isArray(data) ? 1 : 0
        const rows = ok === 1 ? data.length : 0
        const effects = ok === 1 ? data.filter((item) => item === 1).length : 0

        const result = {}

        result.ok = ok
        if (operation === 'update') result.nModified = effects
        result.n = rows

        return result
      }
      break
    default:
      afterFunc = super._getAfter(operation)
      break
    }

    return afterFunc
  }

  _fetchData (data) {
    const that = this

    if (!data) return null

    if (Array.isArray(data)) {
      return data.map((item) => that._fetchData(item))
    }

    const wrapFunc = that.wrapData.bind(that)

    if (data.save &&
      typeof data.save === 'function') {
      const saveFunc = data.save

      data.save = function (callback) {
        return aq.pcall(
          aq.callback((cb) => saveFunc(cb)),
          callback
        )
      }
    }

    if (!data.toObject) {
      data.toObject = () => that._toObject(data)
    }

    return wrapFunc(data, { target: 'from' })
  }


}

module.exports = OrmDbAdapter
