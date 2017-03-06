// import libs
const Mongoose = require('mongoose')
const core = require('nblue-core')

const aq = core.aq
const co = core.co

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
    // define functions
    const createFunc = this._create.bind(this)
    const incrementFunc = this._increment.bind(this)

    // create multi item
    if (options && options.multi && Array.isArray(body)) {
      return aq.parallel(
          body.map((item) => createFunc(item, options))
        )
    }

    // get instance of model
    const model = this.Model

    // set class for model
    const Model = model

    // create new item with body
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
    // get instance of model
    const model = this.Model

    // get auto increment for create
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
    // get instance of model
    const model = this.Model

    // get method name form options
    const methodName = options && options.method ? options.method : 'find'

    const {
      limit, pager, projection, skip, sort
    } = this.parseOptions(options, 'retrieve')

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

      // parse skip
      if (skip) pending = pending.skip(skip)

      // parse limit or top
      if (limit) pending = pending.limit(limit)
    }

    return aq.callback((cb) => pending.exec(cb))
  }

  _update (filter, modifier, options) {
    // get instance of model
    const model = this.Model

    // set options for update
    const opts = this.resetOptions(options, 'update')

    return aq.callback((cb) => model.update(filter, modifier, opts, cb))
  }

  _delete (filter, options) {
    // get instance of model
    const model = this.Model

    return aq.callback((cb) => model.remove(filter, cb))
  }

  _createModel (caller) {
    // get schema by entity name
    const schema = this.getSchema()
    const name = schema.name

    if (schema === null) throw new Error(`Can't find model by schema: ${name}`)

    // get mongo connection from connection
    const mongoConn = this.Connection

    if (!mongoConn) {
      throw new Error(`Can't find mongoose connection by database: ${name}`)
    }

    // define function for eval value
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

    // get instance of model
    const model = schema.model

    // create array of keys that need remove from delete options
    const delOpts = ['wrapper', 'validate', 'table']

    // create new object for options
    const opts = {}

    // copy schema options to options
    Object.assign(opts, schema.options || {})

    // remove some keys from delete options
    delOpts.forEach((key) => {
      if (opts[key]) Reflect.deleteProperty(opts, key)
    })

    // bind validate function
    opts.validateBeforeSave = this.ValidateBeforeSave

    // get mongoos schema from connection
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
