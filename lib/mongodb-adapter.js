// import libs
const DbAdapter = require('./db-adapter')
const aq = global.aq

// define const
const defaultStartValueOfIncrement = 0
const defaultStepValueOfIncrement = 1
const fieldUniqueId = '_id'
const errorCodeOfDuplicationKey = 11000

class MongoDbAdapter extends DbAdapter
{

  constructor (name, connections) {
    super(name)

    this._connections = connections
    this._collections = new Map()
  }

  get Connections () {
    return this._connections
  }

  get Collections () {
    return this._collections
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

  getCollecton (caller) {
    const ctx = caller ? caller : this

    // get schema by entity name
    const name = ctx.Name
    const collections = ctx.Collections

    if (collections.has(name)) {
      return collections.get(name)
    }

    const conns = ctx.Connections
    const schema = ctx.getSchema(ctx)

    if (schema === null) throw new Error(`Can't find model by schema: ${name}`)

    // get connection by entity name from pool
    const conn = conns.getByName(schema.database)

    if (conn === null) throw new Error(`Can't find model by database: ${name}`)

    let collectionName = name

    if (schema.options &&
      schema.options.collection) {
      collectionName = schema.options.collection
    }

    const mongoDbConn = conn.Connection
    const collection = mongoDbConn.collection(collectionName)

    // insert collection to cache
    if (!collections.has(name)) {
      collections.set(name, collection)
    }

    return collection
  }

  _create (body, options) {
    const ctx = options && options.caller ? options.caller : this

    if (!(options.multi ||
      options.autoIncrement) && Array.isArray(body)) {
      return (resolver) => aq.
            parallel(body.map(
              (item) => ctx.createPromise(ctx._create(item, options)))).
            then((data) => resolver(null, data)).
            catch((err) => resolver(err))
    }

    const collection = ctx.getCollecton(ctx)

    return Promise.
      resolve(0).
      then(() => {
        // validate body, ingore now
        if (ctx.ValidateBeforeSave) {
          return Promise.resolve(0)
        }

        return Promise.resolve(0)
      }).
      then(() => {
        // call increment function for item
        if (options.autoIncrement) {
          return ctx._increment(body, options)
        }

        return Promise.resolve(true)
      }).
      then(() => {
        const method = options && options.multi ? 'insertMany' : 'insertOne'

        return ctx.createPromise(
          (callback) => collection[method](body, options, callback)
        )
      }).
      catch((err) => {
        if (err.code === errorCodeOfDuplicationKey) {
          return ctx._create(body, options)
        }

        return Promise.reject(err)
      })
  }

  _increment (body, options) {
    const ctx = options && options.caller ? options.caller : this
    const collection = ctx.getCollecton(ctx)
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
    return Promise.
      resolve(0).
      then(() => collection.
          find({}).
          project(JSON.parse(`{"${field}": 1, "_id": 0}`)).
          sort(JSON.parse(`{"${field}": -1}`)).
          limit(1).
          toArray()
      ).
      then((data) => {
        // set new value to auto increment field
        const newData = Array.isArray(data) ? data[0] : data

        body[field] = newData ? newData[field] + step : start

        return body
      })
  }

  _retrieve (filter, options) {
    const ctx = options && options.caller ? options.caller : this
    const collection = ctx.getCollecton(ctx)

    const method = options && options.method ? options.method : 'find'

    const {
      projection, sort, limit, pager
    } = ctx._parseOptions(options, 'retrieve')

    if (method === 'findOne') {
      // process options
      const oneOptions = ctx._resetOptions(options, 'retrieve')

      if (projection) oneOptions.fields = projection

      return ctx.createPromise(
        (callback) => collection[method](filter, oneOptions, callback)
      )
    } else if (method === 'count') {
      return ctx.createPromise(
        (callback) => collection[method](filter, options, callback)
      )
    }

    let cursor = collection.
      find({}, ctx._resetOptions(options, 'retrieve')).
      filter(filter).
      project(projection)

    if (sort) cursor = cursor.sort(sort)

    // parse pager
    if (pager) {
      cursor = cursor.
        skip(pager.size * (pager.page - 1)).
        limit(pager.size)
    }

    // parse limit or top
    if (limit) cursor = cursor.limit(limit)

    // execute resolver
    return new Promise(
      (resolve, reject) => {
        try {
          resolve(cursor.toArray())
        } catch (err) {
          reject(err)
        }
      })
  }

  _parseOptions (options, oper) {
    switch (oper) {
    case 'retrieve': {
      // declare
      let
        limit = null,
        pager = null,
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

      if (options.limit) limit = options.limit
      else if (options.top) limit = options.top

      if (projection !== null && Array.isArray(projection)) {
        const newFields = {}

        projection.forEach((field) => {
          newFields[field] = 1
        })

        if (newFields[fieldUniqueId] === null) {
          newFields[fieldUniqueId] = 0
        }
        projection = newFields
      }

      if (options && options.sort) {
        sort = options.sort
      }

      const result = {}

      result.projection = projection
      result.sort = sort
      result.pager = pager
      result.limit = limit

      return result
    }
    default:
      return options
    }
  }

  _resetOptions (options, oper) {
    const newOptions = {}

    Object.assign(newOptions, options)

    if (newOptions.caller) Reflect.deleteProperty(newOptions, 'caller')

    switch (oper) {
    case 'retrieve': {
      if (newOptions.projection) {
        Reflect.deleteProperty(newOptions, 'projection')
      }
      // if (newOptions.sort) Reflect.deleteProperty(newOptions, 'sort')
      if (newOptions.page) Reflect.deleteProperty(newOptions, 'page')
      if (newOptions.pageSize) Reflect.deleteProperty(newOptions, 'pageSize')
      if (newOptions.top) Reflect.deleteProperty(newOptions, 'top')

      if (newOptions.method) Reflect.deleteProperty(newOptions, 'method')
      break
    }
    default:
      break
    }

    return newOptions
  }

  _update (filter, modifier, options) {
    const ctx = options && options.caller ? options.caller : this
    const collection = ctx.getCollecton(ctx)
    const method = options && options.multi ? 'updateMany' : 'update'

    return ctx.createPromise(
      (callback) =>
          collection[method](filter, { $set: modifier }, options, callback)
    )
  }

  _delete (filter, options) {
    const ctx = options && options.caller ? options.caller : this
    const collection = ctx.getCollecton(ctx)
    const method = options && options.multi ? 'deleteMany' : 'deleteOne'

    return ctx.createPromise(
      (callback) => collection[method](filter, options, callback)
    )
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
      afterFunc = (data) => {
        if (data.result && data.ops) {
          let ops = data.ops

          if (Array.isArray(ops) && ops.length === 1) {
            ops = ops[0]
          }

          return ctx.simpleData(ops)
        }

        return data
      }
      break
    case 'retrieve':
      afterFunc = (data) => ctx.simpleData(data, ctx)
      break
    case 'update':
      afterFunc = (data) => {
        if (data.result) {
          return data.result
        }

        return data
      }
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
