// import libs
const Mongoose = require('mongoose')
const DbAdapter = require('./db-adapter')
const aq = global.aq

// define const
const defaultStartValueOfIncrement = 0
const defaultStepValueOfIncrement = 1
const fieldUniqueId = '_id'
const errorCodeOfDuplicationKey = 11000

Mongoose.Promise = global.Promise

class MongooseDbAdapter extends DbAdapter
{

  constructor (name, connection) {
    super(name, connection)

    this._model = this.createModel()
  }

  get Model () {
    return this._model
  }

  simpleData (data, caller) {
    const ctx = caller ? caller : this

    if (!data) return null

    if (Array.isArray(data)) {
      return data.map((item) => ctx.simpleData(item), ctx)
    }

    let result = data

    if (result.toObject &&
      typeof result.toObject === 'function') {
      result = result.toObject()
    }

    return ctx.wrapData(result, { target: 'from' }, ctx)
  }

  createModel (caller) {
    const ctx = caller ? caller : this

    // get schema by entity name
    const name = ctx.Name
    const schema = ctx.getSchema(ctx)

    if (schema === null) throw new Error(`Can't find model by schema: ${name}`)

    // get mongo connection from connection
    const mongoConn = this.Connection.Connection

    if (!mongoConn) {
      throw new Error(`Can't find mongoose connection by database: ${name}`)
    }

    const evalValue = (parent) => {
      Object.
        keys(parent).
        forEach((key) => {
          const startLength = 2
          const endLength = 3
          const current = parent[key]

          if (typeof current === 'object') {
            evalValue(current)
          } else if (
            typeof current === 'string' &&
              (current.startsWith('${') && current.endsWith('}'))) {
            // eval expression defined in string, like ${date.now()}
            const evalfunc = (data) => {
              const evalBody = String.format(
                              '(function() { return %s })()',
                              data.substr(startLength, data.length - endLength)
                            )

              return global.eval(evalBody)
            }

            parent[key] = evalfunc(current)
          }
        })

      return parent
    }

    // set model to eval value
    // const model = evalValue(schema.model)
    const model = schema.model
    const options = {}

    Object.assign(options, schema.options || {})

    if (options.wrapper) Reflect.deleteProperty(options, 'wrapper')
    if (options.validate) Reflect.deleteProperty(options, 'validate')

    options.validateBeforeSave = ctx.ValidateBeforeSave

    // mongoConnection.name(name, )
    const mongoSchema = Mongoose.Schema(model, options)

    // create mongoose model by name and schema
    return mongoConn.model(name, mongoSchema)
  }

  _create (body, options) {
    const ctx = options && options.caller ? options.caller : this

    // create multi item
    if (options && options.multi) {
      if (Array.isArray(body)) {
        return aq.
            parallel(
              body.map(
                (item) => ctx._create(item, options)
              )
            )
      }
    }

    const model = ctx.Model
    const Model = model
    const item = new Model(body)

    return Promise.
        resolve(0).
        then(() => {
          // call increment function for item
          if (options.autoIncrement) {
            return ctx._increment(item, options)
          }

          return Promise.resolve(0)
        }).
        then(() =>
          ctx.createPromise((callback) => item.save(callback))
        ).
        catch((err) => {
          if (err.code === errorCodeOfDuplicationKey) {
            return ctx._create(body, options)
          }

          return Promise.reject(err)
        })
  }

  _increment (body, options) {
    const ctx = options && options.caller ? options.caller : this
    const model = ctx.Model
    const autoIncrement = options.autoIncrement

      // init variants
    const field = autoIncrement.field ? autoIncrement.field : null

    if (!field) throw new Error('Can find auto increment field.')

      // get variants for auto increment
    const start = autoIncrement.startValue
                      ? autoIncrement.startValue
                      : defaultStartValueOfIncrement

    const step = autoIncrement.step
                    ? autoIncrement.step
                    : defaultStepValueOfIncrement

    // find the maximun value for auto increment field
    const findPending = model.
          find({}, JSON.parse(`{"${field}": 1, "_id": 0}`)).
          sort(JSON.parse(`{"${field}": -1}`)).
          limit(1)

    return findPending.
        exec((err, data) => {
          if (err) return Promise.reject(err)

          return Promise.resolve(data)
        }).
        then((data) => {
          // set new value to auto increment field
          const newData = Array.isArray(data) ? data[0] : data

          body[field] = newData ? newData[field] + step : start

          return body
        })
  }

  _retrieve (filter, options) {
    const ctx = options && options.caller ? options.caller : this
    const model = ctx.Model
    const method = options && options.method ? options.method : 'find'

    const {
      projection, sort, limit, pager
    } = ctx.parseOptions(options, 'retrieve')

    // call method with arguments
    let pending = model[method](filter, projection)

    if (!(method === 'count' || method === 'findOne')) {
        // parse sorter
      if (sort) {
        pending = pending.sort(sort)
      }

        // parse pager
      if (pager) {
        pending =
            pending.
              skip(pager.size * (pager.page - 1)).
              limit(pager.size)
      }

      // parse limit or top
      if (limit) pending = pending.limit(limit)
    }

    return ctx.createPromise(
      (callback) => pending.exec(callback)
    )
  }

  _update (filter, modifier, options) {
    const ctx = options && options.caller ? options.caller : this
    const updateOptions = ctx.resetOptions(options, 'update', ctx)

    return ctx.createPromise(
      (callback) => ctx.Model.update(filter, modifier, updateOptions, callback)
    )
  }

  _delete (filter, options) {
    const ctx = options && options.caller ? options.caller : this

    return ctx.createPromise(
      (callback) => ctx.Model.remove(filter, callback)
    )
  }

  _parseOptions (options, oper) {
    // const ctx = options.caller ? options.caller : this

    switch (oper) {
    case 'retrieve': {
      const projection = options.projection

      if (projection &&
        projection[fieldUniqueId] === null) {
        projection[fieldUniqueId] = 0
        options.projection = projection
      }
      break
    }
    default:
      break
    }

    return options
  }

  _getBefore (operation) {
    // keep to use it in the future
    // const ctx = caller ? caller : this

    let beforeFunc = null

    switch (operation) {
    case 'create':
      beforeFunc = null
      break
    default:
      break
    }

    return beforeFunc
  }

  _getAfter (operation, caller) {
      // keep to use it in the future
    const ctx = caller ? caller : this

    let afterFunc = null

    switch (operation) {
    case 'create':
    case 'retrieve':
      afterFunc = (data) => ctx.simpleData(data, ctx)
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
      break
    }

    return afterFunc
  }

}

module.exports = MongooseDbAdapter
