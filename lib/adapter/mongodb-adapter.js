// import libs
const DbAdapter = require('./db-adapter')
const core = require('nblue-core')

const aq = core.aq
const co = core.co

// define const
const defaultStartValueOfIncrement = 0
const defaultStepValueOfIncrement = 1
const fieldUniqueId = '_id'
const errorCodeOfDuplicationKey = 11000

class MongoDbAdapter extends DbAdapter {

  constructor (connection, schema) {
    super(connection, schema)

    this._collection = this.getCollecton()
  }

  get Collection () {
    return this._collection
  }

  getObjectId (id) {
    const mongodb = require('mongodb')
    const ObjectID = mongodb.ObjectID

    return new ObjectID(id)
  }

  getCollecton () {
    // get instance of schmea
    const schema = this.getSchema()

    // get options from schema by model
    const options = this.getOptions() || {}

    // get collection name from options or use schema name as default
    const name = options.collection ? options.collection : schema.name

    // get instance of connection
    const connection = this.Connection

    // return collection by name
    return connection.collection(name)
  }

  get (id, options, callback) {
    // assign options to opts
    const opts = options || {}

    // set method to opts
    opts.method = 'findOne'

    // init
    const filter = { }

    // append id to filter
    filter[fieldUniqueId] = this.getObjectId(id)

    // retrieve one object by id
    return this.retrieve(filter, opts, callback)
  }

  _create (body, options) {
    const createFunc = this._create.bind(this)
    const incrementFunc = this._increment.bind(this)

    if (!(options.multi ||
      options.autoIncrement) && Array.isArray(body)) {
      return (resolver) => aq.
        parallel(body.map(
          (item) => aq.callback(createFunc(item, options)))).
        then((data) => resolver(null, data)).
        catch((err) => resolver(err))
    }

    // get model collection
    const collection = this.getCollecton()

    return co(function *() {
      if (options.autoIncrement) {
        yield incrementFunc(body, options)
      }

      // get method name of insert operation and collection
      const methodName = options && options.multi ? 'insertMany' : 'insertOne'

      // call method
      return aq.callback((cb) => collection[methodName](body, options, cb))
    }).
      catch((err) => {
        if (err.code === errorCodeOfDuplicationKey) {
          return createFunc(body, options)
        }

        // reject error
        return Promise.reject(err)
      })
  }

  _increment (body, options) {
    // get auto increment from options
    const autoIncrement = options.autoIncrement

    // get increment field from options
    const field = autoIncrement.field ? autoIncrement.field : null

    // throw error if there is no field for increment
    if (!field) throw new Error('Can find auto increment field.')

    // get start value for increment
    const start = autoIncrement.startValue
      ? autoIncrement.startValue
      : defaultStartValueOfIncrement

    // get step value for increment
    const step = autoIncrement.step
      ? autoIncrement.step
      : defaultStepValueOfIncrement

    // get model collection
    const collection = this.getCollecton()

    // get a Promise to execute generator function
    return co(function *() {
      // find the max value from collection
      const data = yield collection.
        find({}).
        project(JSON.parse(`{"${field}": 1, "_id": 0}`)).
        sort(JSON.parse(`{"${field}": -1}`)).
        limit(1).
        toArray()

      // set new value to auto increment field
      const newBody = Array.isArray(data) ? data[0] : data

      // set increment value to targetfield
      body[field] = newBody ? newBody[field] + step : start

      // resolve body
      return body
    })
  }

  _retrieve (filter, options) {
    // get method name of retrieve
    const methodName = options && options.method ? options.method : 'find'

    // get model collection
    const collection = this.getCollecton()

    // get retrieve parameters from options
    const {
      limit, pager, projection, skip, sort
    } = this.parseOptions(options, 'retrieve')

    // create new opts for retrieve
    const opts = this.resetOptions(options, 'retrieve')

    switch (methodName) {
    case 'findOne':
      // process options
      if (projection) opts.fields = projection

      return aq.callback((cb) => collection[methodName](filter, opts, cb))
    case 'count':
      return aq.callback((cb) => collection[methodName](filter, opts, cb))
    default:
      break
    }

    // create cursor for retrieve
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

    // parse skip
    if (skip) cursor = cursor.skip(skip)

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
    // get method name of update
    const methodName = options && options.multi ? 'updateMany' : 'update'

    // get model collection
    const collection = this.getCollecton()

    // invoke method base on collection
    return aq.callback(
      (cb) => collection[methodName](filter, { $set: modifier }, options, cb)
    )
  }

  _delete (filter, options) {
    // get method name of delete
    const methodName = options && options.multi ? 'deleteMany' : 'deleteOne'

    // get model collection
    const collection = this.getCollecton()

    // invoke method base on collection
    return aq.callback(
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
    // define function for fetch data
    const fetchFunc = this._fetchData.bind(this)

    // delcare function for after invoke collection method
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

          return fetchFunc(ops)
        }

        return data
      }
      break
    case 'retrieve':
      afterFunc = (data) => fetchFunc(data)
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
    // const that = this
    if (!data) return null

    // return array
    if (Array.isArray(data)) {
      // define function for fetch data
      const fetchFunc = this._fetchData.bind(this)

      // fetch every item in array
      return data.map((item) => fetchFunc(item))
    }

    // define function for fetch data
    const toObjectFunc = this._toObject.bind(this)

    if (!data.toObject) {
      data.toObject = () => toObjectFunc(data)
    }

    if (!data.save) {
      // define update functions to bind target data
      const saveFunc = data.save
      const updateFunc = this.update.bind(this)
      const getFunc = this.retrieve.bind(this)

      data.save = function (callback) {
        return aq.pcall(
          co(function *() {
            const rt1 = yield updateFunc({ _id: data._id }, data.toObject())

            if (!rt1.ok) throw new Error('save failed')

            const rt2 = yield getFunc({ _id: data._id })

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
      // define delete functions to bind target data
      const deleteFunc = this.delete.bind(this)

      data.remove = function (callback) {
        return aq.pcall(
          deleteFunc({ _id: data._id }).
            then(() => data.toObject()),
          callback
        )
      }
    }

    // call wrap func
    return this.wrapData(data, { target: 'from' })
  }

}

module.exports = MongoDbAdapter
