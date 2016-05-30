// import libs
const Mongoose = require('mongoose')
const DbAdapter = require('./dbadapter')

// define const
const defaultStartValueOfIncrement = 0
const defaultStepValueOfIncrement = 1
const fieldUniqueId = '_id'
const errorCodeOfDuplicationKey = 11000

class MongooseDbAdapter extends DbAdapter
{

  constructor (name, connections) {
    super(name)

    this._connections = connections
    this._simpleData = false
  }

  get Connections () {
    return this._connections
  }

  get SimpleData () {
    return this._simpleData
  }
  set SimpleData (val) {
    if (typeof val !== 'boolean') throw new Error('invalid type of val')
    this._simpleData = val
  }

  pcreate (model, body, resolver) {
    const Model = model

    const entity = new Model(body)

    if (!this.ValidateBeforeSave === true) {
      // save entity directly
      entity.save(resolver)
    } else {
      // validate schema in the first
      entity.validate((err) => {
        if (err) {
          // found issue, exit
          resolver(new Error(`validate schema failed, details: ${err.message}`))

          return
        }

        // save entity
        entity.save(resolver)
      })
    }
  }

  pcreateWithIncrement (
    body, autoIncrement, pending, callback, caller) {
    const ctx = caller ? caller : this

    const model = ctx.getModel(ctx)
    const wrapper = ctx.getWrapper(ctx)

    return new Promise((resolve, reject) => {
      try {
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

        findPending.exec((err, data) => {
          if (err) return Promise.reject(err)

          return Promise.resolve(data)
        }).
          then((data) => {
            // set new value to auto increment field
            const newData = Array.isArray(data) ? data[0] : data

            body[field] = newData ? newData[field] + step : start

            return body
          }).
          then(() => {
            callback(model, (err, data) => {
              // reject error
              if (err) throw err

              let newData = data

              // wrapper data
              if (wrapper && wrapper.from) {
                newData = wrapper.from(newData)
              }

              // resolve data
              resolve(newData)
            })
          }).
          catch((err) => {
            if (err.code === errorCodeOfDuplicationKey) {
              return pending(
                model, body, autoIncrement, wrapper, pending, callback)
            }

            return reject(err)
          })
      } catch (err) {
        reject(err)
      }
    })
  }

  pretrieve (model, method, resolver, options) {
    // declare
    let
      filter = {},
      pager = null,
      pending = null,
      projection = null,
      sort = null

    if (options.filter) {
      filter = options.filter
    }

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
    return pending.exec(resolver)
  }

  pupdate (model, resolver, filter, modifier, options) {
    const newOptions = {}

    if (options) Object.assign(newOptions, options)

    if (!newOptions.multi &&
      options && !options.multi) {
      newOptions.multi = false
    } else {
      newOptions.multi = true
    }


    model.update(filter, modifier, newOptions, resolver)
  }

  pdelete (model, resolver, filter) {
    model.remove(filter, resolver)
  }

  createModel (caller) {
    const ctx = caller ? caller : this

    // get schema by entity name
    const name = ctx.Name
    const schema = ctx.getSchema(ctx)

    if (schema === null) throw new Error(`Can't find model by schema: ${name}`)

    // get connection by entity name from pool
    const conn = ctx.Connections.get(schema.database)

    if (conn === null) throw new Error(`Can't find model by database: ${name}`)

    // get mongo connection from connection
    const mongoConnection = conn.Connection

    if (!mongoConnection) {
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
    schema.model = evalValue(schema.model)

    // mongoConnection.name(name, )
    const mongoSchema = Mongoose.Schema(schema.model, schema.options || {})
    // const modelNames = mongoConnection.modelNames()

    // create mongoose model by name and schema
    const model = mongoConnection.model(name, mongoSchema)

    // append prototypes
    if (model) {
      model.prototype.name$ = schema.name
      model.prototype.schema$ = schema
    }

    return model
  }

  getModel (caller) {
    const ctx = caller ? caller : this
    const conns = ctx.Connections

    return ctx.getModelFromSchema(ctx, conns.Models)
  }

  getSchema (caller) {
    const ctx = caller ? caller : this

    const name = ctx.Name
    const schemas = ctx.Connections.Schemas
    const schema = schemas.has(name) ? schemas.get(name) : null

    return schema
  }

  getWrapper (caller) {
    const ctx = caller ? caller : this

    return {
      name: ctx.Name,
      from: null,
      to: null
    }
  }

  getResultFunc (operation, caller) {
    // keep to use it in the future
    const ctx = caller ? caller : this

    let resultFunc = null

    switch (operation) {
    case 'create':
      resultFunc = null
      break
    case 'retrieve':
      resultFunc = (data) => ctx.convertRetrieveResult(data, ctx)
      break
    case 'update':
      resultFunc = null
      break
    case 'delete':
      resultFunc = (data) => {
        if (data.result) return data.result

        return data
      }
      break
    default:
      break
    }

    return resultFunc
  }

  convertRetrieveResult (data, caller) {
    const ctx = caller ? caller : this

    if (!data) return null

    if (Array.isArray(data)) {
      return data.map((item) => ctx.convertRetrieveResult(item), ctx)
    }

    let result = null

    if (ctx.SimpleData) {
      result = data._doc ? data._doc : data
    } else {
      result = data
    }

    const wrapper = ctx.getWrapper(ctx)

    return wrapper && wrapper.from ? wrapper.from(result) : result
  }

}

module.exports = MongooseDbAdapter
