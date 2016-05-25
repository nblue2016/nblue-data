// import libs
const Mongoose = require('mongoose')
const DbAdapter = require('./dbadapter')

// define const
const defaultStartValueOfIncrement = 0
const defaultStepValueOfIncrement = 1
const fieldUniqueId = '_id'
const errorCodeOfDuplicationKey = 11000

class MongoDbAdapter extends DbAdapter
{

  constructor (connections) {
    super()

    // this.models = new Map()
    this._connections = connections

    if (!this._connections.models) {
      this._connections.models = new Map()
    }
  }

  get Models () {
    return this.models
  }

  get Connections () {
    return this._connections
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
    model, body, autoIncrement, wrapper, pending, callback) {
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
        const filter =
          JSON.parse(`{"$query": {}, "$orderby": {"${field}": -1}}`)

        const projection =
          JSON.parse(`{"${field}": 1, "_id": 0}`)

        model.findOne(filter, projection).
          then((data) => {
            // increase value if found old data in database
            body[field] = data ? data[field] + step : start

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
    // parse options
    const filter = options.filter ? options.filter : {}

    const sort = options && options.sort ? options.sort : null

    const pager = options.page && options.pageSize
                    ? {
                      page: options.page,
                      size: options.pageSize
                    }
                    : null

    // convert
    let
      pending = null,
      projection = options && options.projection ? options.projection : null

    if (projection === null) {
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

    // call method with arguments
    pending = model[method](filter, projection)

    if (!(method === 'count' || method === 'findOne')) {
      // pending sorter
      if (sort) {
        pending = pending.sort(sort)
      }

      // pending pager
      if (pager) {
        pending = pending.
          skip(pager.size * (pager.page - 1)).
          limit(pager.size)
      }
    }

    // execute resolver
    return pending.exec(resolver)
  }

  pupdate (model, resolver, filter, modifier) {
    model.update(filter, modifier, resolver)
  }

  pdelete (model, resolver, filter) {
    model.remove(filter, resolver)
  }

  createModel (name) {
    const ctx = this

    // get schema by entity name
    const schema = ctx.getSchema(name)

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
            const fn = (data) => {
              const fnBody = String.format(
                              '(function() { return %s })()',
                              data.substr(startLength, data.length - endLength)
                            )

              return global.eval(fnBody)
            }

            parent[key] = fn(current)
          }
        })

      return parent
    }

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

  getModel (name) {
    const ctx = this

    const models = ctx.Connections.models

    if (!models.has(name)) {
      models.set(name, ctx.createModel(name))
    }

    return models.get(name)
  }

  getSchema (name) {
    const ctx = this

    const schemas = ctx.Connections.Schemas
    const schema = schemas.has(name) ? schemas.get(name) : null

    return schema
  }

  getWrapper () {
    return {
      from: null,
      to: null
    }
  }

}

module.exports = MongoDbAdapter
