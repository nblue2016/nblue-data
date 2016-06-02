// import libs
const Mongoose = require('mongoose')
const DbAdapter = require('./dbadapter')
const aq = global.aq

// define const
const defaultStartValueOfIncrement = 0
const defaultStepValueOfIncrement = 1
const fieldUniqueId = '_id'
const errorCodeOfDuplicationKey = 11000

const models = new Map()

class MongoDbAdapter extends DbAdapter
{

  constructor (name, connections) {
    super(name)

    this._connections = connections
  }

  get Connections () {
    return this._connections
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

  getModel (caller) {
    const ctx = caller ? caller : this
    const name = ctx.Name

    if (!models.has(name)) {
      models.set(name, ctx.createModel(ctx))
    }

    return models.get(name)
  }

  createModel (caller) {
    const ctx = caller ? caller : this

    // get schema by entity name
    const name = ctx.Name
    const schema = ctx.getSchema(ctx)
    const conns = ctx.Connections

    if (schema === null) throw new Error(`Can't find model by schema: ${name}`)

    // get connection by entity name from pool
    const conn = conns.getByName(schema.database)

    if (conn === null) throw new Error(`Can't find model by database: ${name}`)

    // get mongo connection from connection
    const mongoConn = conn.Connection

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
    const model = evalValue(schema.model)

    // mongoConnection.name(name, )
    const mongoSchema = Mongoose.Schema(model, schema.options || {})

    // create mongoose model by name and schema
    return mongoConn.model(name, mongoSchema)
  }

  _create (body, options) {
    const ctx = options && options.caller ? options.caller : this

      // create multi item
    if (options && options.multi) {
      if (Array.isArray(body)) {
        return (resolver) => aq.
            parallel(body.map(
              (item) => ctx.createPromise(ctx._create(item, options)))).
            then((data) => resolver(null, data)).
            catch((err) => resolver(err))
      }
    }

    const model = ctx.getModel()
    const Model = model
    const item = new Model(body)

    return (resolver) => Promise.
        resolve(0).
        then(() => {
          // validate entity schema if it was defined
          if (ctx.ValidateBeforeSave) {
            return new Promise(
              (resolve, reject) => {
                item.validate((err) => {
                  if (err) {
                    reject(err)
                  } else {
                    resolve(0)
                  }
                })
              })
          }

          return Promise.resolve(0)
        }).
        then(() => {
          // call increment function for item
          if (options.autoIncrement) {
            return ctx._increment(item, options)
          }

          return Promise.resolve(true)
        }).
        then(() => item.save(resolver)).
        catch((err) => {
          if (err.code === errorCodeOfDuplicationKey) {
            return ctx._create(body, options)
          }

          return resolver(err)
        })
  }

  _increment (body, options) {
    const ctx = options && options.caller ? options.caller : this
    const model = ctx.getModel(ctx)
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
    const model = ctx.getModel()
    const method = options && options.method ? options.method : 'find'

      // declare
    let
      pager = null,
      pending = null,
      projection = null,
      sort = null

    if (options.page && options.pageSize) {
      pager = {
        page: options.page,
        size: options.pageSize
      }
    }

    if (options && options.projection) {
      projection = options.projection
    } else if (projection === null) {
      projection = options && options.fields ? options.fields : null
    }

    if (projection !== null && Array.isArray(projection)) {
      const newFields = {}

      projection.forEach((field) => {
        newFields[field] = 1
      })

      if (newFields[fieldUniqueId] === null) newFields[fieldUniqueId] = 0
      projection = newFields
    }

    if (options && options.sort) {
      sort = options.sort
    }

    // call method with arguments
    pending = model[method](filter, projection)

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
      if (options) {
        if (options.limit) {
          pending = pending.limit(options.limit)
        } else if (options.top) {
          pending = pending.limit(options.top)
        }
      }
    }

      // execute resolver
    return (resolver) => pending.exec(resolver)
  }

  _update (filter, modifier, options) {
    const ctx = options && options.caller ? options.caller : this
    const model = ctx.getModel()

    return (resolver) =>
        model.update(filter, modifier, options, resolver)
  }

  _delete (filter, options) {
    const ctx = options && options.caller ? options.caller : this
    const model = ctx.getModel()

    return (resolver) => model.remove(filter, resolver)
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

module.exports = MongoDbAdapter
