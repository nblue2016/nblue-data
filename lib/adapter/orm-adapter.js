const nblue = require('nblue')

const aq = nblue.aq
const co = aq.co
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
    return OrmBridge.toORMModel(schema)
  }

  simpleData (data) {
    const that = this

    if (!data) return null

    if (Array.isArray(data)) {
      return data.map((item) => that.simpleData(item))
    }

    const wrapFunc = that.wrapData.bind(that)

    let result = data

    if (data.toObject &&
      typeof data.toObject === 'function') {
      result = result.toObject()
    }

    if (data.save &&
      typeof data.save === 'function') {
      const saveFunc = data.save

      data.save = function (callback) {
        return that._resolveResult(
          that._createPromise((cb) => saveFunc(cb)),
          callback
        )
      }
    }

    return wrapFunc(result, { target: 'from' })
  }

  _create (body, options) {
    const that = this

    const promiseFunc = that._createPromise.bind(that)
    const createFunc = that.Owner.create

    if (options && options.multi) {
      const opts = {}

      Object.assign(opts, options)
      Reflect.deleteProperty(opts, 'multi')

      return aq.parallel(
        body.map((item) => that._create(item, opts))
      )
    }

    return promiseFunc((cb) => createFunc(body, cb))
  }

  _retrieve (filter, options) {
    const that = this

    const methodName = options && options.method ? options.method : 'find'

    const retrieveFunc = that.Owner[methodName]
    const promiseFunc = that._createPromise.bind(that)

    const opts = {}

    if (options.limit) opts.limit = options.limit
    if (options.top) opts.limit = options.top
    if (options.order) opts.order = options.order
    if (options.groupBy) opts.order = options.groupBy

    if (methodName === 'find') {
      return promiseFunc((cb) => retrieveFunc(filter, opts, cb))
    }

    return promiseFunc((cb) => retrieveFunc(filter, cb))
  }

  _update (filter, modifier, options) {
    const that = this

    return null
  }

  _delete (filter, options) {
    const that = this
    const promiseFunc = that._createPromise.bind(that)

    return co(function *() {
      const data = yield that.retrieve(filter)

      const rt = yield aq.parallel(
        data.map(
          (item) =>
            promiseFunc((cb) => item.remove(cb)).
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
      afterFunc = (data) => that.simpleData(data)
      break
    case 'delete':
      afterFunc = (data) => {
        if (data.result) {
          return data.result
        }

        return data
      }
      break
    default:
      afterFunc = super._getAfter(operation)
      break
    }

    return afterFunc
  }

}

module.exports = OrmDbAdapter
