// import libs
const Mongoose = require('mongoose')
const nblue = require('nblue')

const aq = nblue.aq
const co = nblue.co

const DbAdapter = require('./db-adapter')

// define const
const defaultStartValueOfIncrement = 0
const defaultStepValueOfIncrement = 1
const fieldUniqueId = '_id'
const errorCodeOfDuplicationKey = 11000

Mongoose.Promise = Promise

class MongooseDbAdapter extends DbAdapter
{

  constructor (connection, schema) {
    super(connection, schema)

    this._model = this._createModel()
  }

  get Model () {
    return this._model
  }

  _create (body, options) {
    const that = this

    // define functions
    const createFunc = that._create.bind(that)
    const incrementFunc = that._increment.bind(that)

    // create multi item
    if (options && options.multi && Array.isArray(body)) {
      return aq.parallel(
          body.map((item) => createFunc(item, options))
        )
    }

    const model = that.Model
    const Model = model
    const item = new Model(body)

    return co(function *() {
      if (options.autoIncrement) {
        yield incrementFunc(item, options)
      }

      return aq.callback((cb) => item.save(cb))
    }).
    catch((err) => {
      if (err.code === errorCodeOfDuplicationKey) {
        return createFunc(body, options)
      }

      throw err
    })
  }

  _increment (body, options) {
    const that = this

    const model = that.Model
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
    const that = this

    const model = that.Model
    const methodName = options && options.method ? options.method : 'find'

    const {
      projection, sort, limit, pager
    } = that.parseOptions(options, 'retrieve')

    // call method with arguments
    let pending = model[methodName](filter, projection)

    if (!(methodName === 'count' || methodName === 'findOne')) {
        // parse sorter
      if (sort) {
        pending = pending.sort(sort)
      }

      // parse pager
      if (pager) {
        pending = pending.
          skip(pager.size * (pager.page - 1)).
          limit(pager.size)
      }

      // parse limit or top
      if (limit) pending = pending.limit(limit)
    }

    return aq.callback((cb) => pending.exec(cb))
  }

  _update (filter, modifier, options) {
    const that = this

    const model = that.Model
    const opts = that.resetOptions(options, 'update')

    return aq.callback((cb) => model.update(filter, modifier, opts, cb))
  }

  _delete (filter, options) {
    const that = this

    const model = that.Model

    return aq.callback(
      (cb) => model.remove(filter, cb)
    )
  }

  _createModel (caller) {
    const that = this

        // get schema by entity name
    const schema = that.getSchema()
    const name = schema.name

    if (schema === null) throw new Error(`Can't find model by schema: ${name}`)

        // get mongo connection from connection
    const mongoConn = that.Connection

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
            const evalFunc = (data) => {
              const evalBody = String.format(
                '(function() { return %s })()',
                data.substr(startLength, data.length - endLength)
              )

              return eval(evalBody)
            }

            parent[key] = evalFunc(current)
          }
        })

      return parent
    }

        // set model to eval value
        // const model = evalValue(schema.model)
    const model = schema.model
    const delOpts = ['wrapper', 'validate', 'table']
    const opts = {}

    Object.assign(opts, schema.options || {})
    delOpts.forEach((key) => {
      if (opts[key]) Reflect.deleteProperty(opts, key)
    })

    opts.validateBeforeSave = that.ValidateBeforeSave

        // mongoConnection.name(name, )
    const mongoSchema = Mongoose.Schema(model, opts)

        // create mongoose model by name and schema
    return mongoConn.model(name, mongoSchema)
  }

  _parseOptions (options, oper) {
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
    let beforeFunc = null


    switch (operation) {
    default:
      beforeFunc = super._getBefore(operation)
      break
    }

    return beforeFunc
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

  _fetchData (data) {
    const that = this

    if (!data) return null

    if (Array.isArray(data)) {
      return data.map((item) => that._fetchData(item))
    }

    const wrapFunc = that.wrapData.bind(that)

    if (!data.remove) {
      data.remove = function (callback) {
        return aq.pcall(
            that.
              delete({ _id: data._id }).
              then(() => data.toObject()),
            callback
          )
      }
    }

    return wrapFunc(data, { target: 'from' })
  }

}

module.exports = MongooseDbAdapter
