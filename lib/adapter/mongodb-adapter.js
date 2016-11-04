// import libs
const DbAdapter = require('./db-adapter')
const nblue = require('nblue')

const aq = nblue.aq
const co = aq.co

// define const
const defaultStartValueOfIncrement = 0
const defaultStepValueOfIncrement = 1
const fieldUniqueId = '_id'
const errorCodeOfDuplicationKey = 11000

class MongoDbAdapter extends DbAdapter
{

  constructor (connection, schema) {
    super(connection, schema)

    this._collection = this.getCollecton()
  }

  get Collection () {
    return this._collection
  }

  getCollecton () {
    const that = this

    const schema = that.getSchema()
    const options = that.getOptions()

    // get schema by entity name
    const collectionName = options && options.collection
      ? options.collection
      : schema.name

    return that.Connection.collection(collectionName)
  }

  _create (body, options) {
    const that = this
    const createFunc = that._create.bind(that)
    const incrementFunc = that._increment.bind(that)

    if (!(options.multi ||
      options.autoIncrement) && Array.isArray(body)) {
      return (resolver) => aq.
            parallel(body.map(
              (item) => aq.back(createFunc(item, options)))).
            then((data) => resolver(null, data)).
            catch((err) => resolver(err))
    }

    return co(function *() {
      if (options.autoIncrement) {
        yield incrementFunc(body, options)
      }

      // get method name of insert operation and collection
      const methodName = options && options.multi ? 'insertMany' : 'insertOne'
      const collection = that.getCollecton()

      // call method
      return aq.back(
        (cb) => collection[methodName](body, options, cb)
      )
    }).
    catch((err) => {
      if (err.code === errorCodeOfDuplicationKey) {
        return createFunc(body, options)
      }

      return Promise.reject(err)
    })
  }

  _increment (body, options) {
    const that = this

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

    const collection = that.getCollecton()

    return co(function *() {
      const data = yield collection.
        find({}).
        project(JSON.parse(`{"${field}": 1, "_id": 0}`)).
        sort(JSON.parse(`{"${field}": -1}`)).
        limit(1).
        toArray()

        // set new value to auto increment field
      const newBody = Array.isArray(data) ? data[0] : data

      body[field] = newBody ? newBody[field] + step : start

      return Promise.resolve(body)
    })
  }

  _retrieve (filter, options) {
    const that = this

    // get method name of retrieve and collection
    const methodName = options && options.method ? options.method : 'find'
    const collection = that.getCollecton(that)

    const {
      projection, sort, limit, pager
    } = that.parseOptions(options, 'retrieve')

    const opts = that.resetOptions(options, 'retrieve')

    switch (methodName) {
    case 'findOne':
      // process options
      if (projection) opts.fields = projection

      return aq.back((cb) => collection[methodName](filter, opts, cb))
    case 'count':
      return aq.back((cb) => collection[methodName](filter, opts, cb))
    default:
      break
    }

    let cursor =
      collection.
        find({}, opts).
        filter(filter).
        project(projection)

    if (sort) {
      cursor = cursor.sort(sort)
    }

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

  _update (filter, modifier, options) {
    const that = this

    // get method name of update and collection
    const methodName = options && options.multi ? 'updateMany' : 'update'
    const collection = that.getCollecton()

    return aq.back(
      (cb) => collection[methodName](filter, { $set: modifier }, options, cb)
    )
  }

  _delete (filter, options) {
    const that = this

    // get method name of delete and collection
    const methodName = options && options.multi ? 'deleteMany' : 'deleteOne'
    const collection = that.getCollecton()

    return aq.back(
      (cb) => collection[methodName](filter, options, cb)
    )
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

  _getAfter (operation) {
      // keep to use it in the future
    const that = this

    let afterFunc = null

    switch (operation) {
    case 'create':
      afterFunc = (data) => {
        if (data.result && data.ops) {
          let ops = data.ops

          if (
            Array.isArray(ops) && ops.length === 1) {
            ops = ops[0]
          }

          return that._fetchData(ops)
        }

        return data
      }
      break
    case 'retrieve':
      afterFunc = (data) => that._fetchData(data, that)
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

    if (!data.toObject) {
      data.toObject = () => that._toObject(data)
    }

    if (!data.save) {
      const saveFunc = data.save

      data.save = function (callback) {
        return that._resolveResult(
            co(function *() {
              const rt1 = yield that.update({ _id: data._id }, data.toObject())

              if (!rt1.ok) throw new Error('save failed')

              const rt2 = yield that.retrieve({ _id: data._id })

              if (Array.isArray(rt2)) {
                return Promise.resolve(rt2.length > 0 ? rt2[0] : null)
              }

              return rt2
            }),
            callback
          )
      }
    }

    if (!data.remove) {
      data.remove = function (callback) {
        return that._resolveResult(
            that.
              delete({ _id: data._id }).
              then(() => data.toObject()),
            callback
          )
      }
    }

    return that.wrapData(data, { target: 'from' })
  }

}

module.exports = MongoDbAdapter
