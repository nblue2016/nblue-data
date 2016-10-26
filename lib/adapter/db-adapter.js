require('nblue')
const Schemas = require('.././schema/schemas')
const EventEmitter = require('events').EventEmitter

// support CRUD opetions for one database system
class DbAdapter extends EventEmitter {

  constructor (schema, connection) {
    if (!schema) throw new Error('invalid name')
    if (!connection) throw new Error('invalid connection')

    super()

    // init private variants
    this._schema = schema
    this._connection = connection
    this._validateBeforeSave = false
  }

  get Name () {
    return this._schema.Name
  }

  get Connection () {
    return this._connection
  }

  get ValidateBeforeSave () {
    return this._validateBeforeSave
  }
  set ValidateBeforeSave (val) {
    this._validateBeforeSave = val
  }

  getCallback (options, callback) {
    if (typeof options === 'function' && !callback) {
      return options
    }

    return callback
  }

  create (body, options, callback) {
    const ctx = this
    const newOptions = {}

    // init options
    newOptions.caller = ctx
    newOptions.autoIncrement = ctx.getAutoIncrement()
    if (!newOptions.multi) {
      newOptions.multi = Array.isArray(body)
    }

    // init creating options
    if (options && typeof options === 'object') {
      Object.assign(newOptions, options)
    }

    // create promise function for creation
    const pending = Promise.
      resolve(0).
      then(() => {
        // set default value for body
        Schemas.setDefaultValues(body, ctx.getModel(ctx))

        return body
      }).
      then((data) => {
        // warp data if it defined function
        const wrapOptions = { target: 'to' }

        // return wrapped value
        return ctx.wrapData(data, wrapOptions, ctx)
      }).
      then((data) => {
        // validate date before save
        if (ctx.ValidateBeforeSave) {
          ctx.validate(data)
        }

        return data
      })

    // invoke create method if there is no auto increment field.
    return ctx.
        resolvePromise(
          pending.then((data) => ctx._create(data, newOptions)),
          ctx._getAfter('create', ctx),
          ctx.getCallback(options, callback)
        )
  }

  retrieve (filter, options, callback) {
    const ctx = this
    const retrOptions = {}

    // init retrieving options
    retrOptions.caller = ctx
    if (options && typeof options === 'object') {
      Object.assign(retrOptions, options)
    }

    // invoke create method if there is no auto increment field.
    return ctx.
        resolvePromise(
          ctx._retrieve(filter, retrOptions),
          ctx._getAfter('retrieve', ctx),
          ctx.getCallback(options, callback)
        )
  }

  update (filter, modifier, options, callback) {
    const ctx = this
    let
      newFilter = filter,
      newModifier = modifier,
      updateOptions = {}

    // init updating options
    updateOptions.caller = ctx
    updateOptions.multi = true
    if (options && typeof options === 'object') {
      Object.assign(updateOptions, options)
    }

    if (typeof newFilter === 'string') newFilter = JSON.parse(newFilter)
    if (typeof newModifier === 'string') newModifier = JSON.parse(newModifier)

    const pending = Promise.
      resolve(newModifier).
      then((data) => {
        // wrap data
        const wrapOptions = {
          target: 'to',
          keys: Object.keys(modifier)
        }

        // wrap data
        return ctx.wrapData(data, wrapOptions, ctx)
      }).
      then((data) => {
        // validate data before save
        if (ctx.ValidateBeforeSave) {
          ctx.validate(data, ctx)
        }

        return data
      })

    updateOptions = ctx.resetOptions(updateOptions, 'update', ctx)

    // invoke create method if there is no auto increment field.
    return ctx.
        resolvePromise(
          pending.
            then((data) => ctx._update(newFilter, data, updateOptions)),
          ctx._getAfter('update', ctx),
          ctx.getCallback(options, callback)
        )
  }

  delete (filter, options, callback) {
    const ctx = this
    const deleteOptions = {}

    deleteOptions.multi = true

    // init deleting options
    deleteOptions.caller = ctx
    if (options && typeof options === 'object') {
      Object.assign(deleteOptions, options)
    }

    const newFilter = typeof filter === 'string' ? JSON.parse(filter) : filter

    // invoke create method if there is no auto increment field.
    return ctx.
        resolvePromise(
          ctx._delete(newFilter, deleteOptions),
          ctx._getAfter('delete', ctx),
          ctx.getCallback(options, callback)
        )
  }

  count (filter, callback) {
    const ctx = this

    return ctx.
        resolvePromise(
          ctx._retrieve(filter, { method: 'count' }, callback),
          ctx._getAfter('count', ctx),
          callback
        )
  }

  validate (data) {
    const ctx = this
    const options = ctx.getOptions(ctx)

    // find validate function in schema
    if (options.validate &&
        typeof options.validate === 'function') {
      // execute validate function if found
      Reflect.apply(options.validate, ctx, [data])
    } else {
      // use auto validate by default
      ctx.autoValidate(data)
    }
  }

  autoValidate (data) {
    const ctx = this
    const schema = ctx.getSchema(ctx)

    Schemas.validateEntityBySchema(data, schema)
  }

  createPromise (invokeFunc) {
    return new Promise((resolve, reject) => {
      const callback = (err, data) => {
        if (err) reject(err)
        resolve(data)
      }

      invokeFunc(callback)
    })
  }

  resolvePromise (promise, afterFunc, callback) {
    return promise.
      then((data) => {
        // process result
        if (afterFunc) {
          return afterFunc(data)
        }

        return data
      }).
      then((data) => {
        if (callback) {
          return callback(null, data)
        }

        return data
      }).
      catch((err) => {
        if (callback) {
          return callback(err, null)
        }

        throw err
      })
  }

  getWrapper () {
    const ctx = this

    if (ctx._wrapper !== null) {
      return ctx._wrapper
    }

    return {
      name: ctx.Name,
      from: null,
      to: null
    }
  }

  getSchema () {
    const ctx = this

    return ctx._schema
  }

  getModel () {
    const ctx = this
    const schema = ctx.getSchema()

    return Schemas.getModel(schema)
  }

  getOptions (caller) {
    const ctx = caller ? caller : this
    const schema = ctx.getSchema(ctx)

    return schema ? schema.options : {}
  }

  getAutoIncrement (caller) {
    const ctx = caller ? caller : this
    const options = ctx.getOptions(ctx)

    return options && options.autoIncrement
      ? options.autoIncrement
      : null
  }

  wrapData (data, options, caller) {
    const ctx = caller ? caller : this

    if (Array.isArray(data)) {
      return data.map((item) => ctx.wrapData(item, options, ctx))
    }

    const dataOptions = ctx.getOptions(ctx)

    if (dataOptions && dataOptions.methods) {
      Object.
          keys(dataOptions.methods).
          forEach((key) => {
            data[key] = dataOptions.methods[key]
          })
    }

    const wrapper = ctx.getWrapper ? ctx.getWrapper(ctx) : null

    if (wrapper) {
      const newOptions = {}

      newOptions.target = 'to'
      Object.assign(newOptions, options)

      if (wrapper[newOptions.target]) {
        const wrapperFunc = wrapper[newOptions.target]

        return wrapperFunc(data, newOptions.keys)
      }
    }

    return data
  }

  parseOptions (options, oper) {
    const ctx = options.caller ? options.caller : this

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

      ctx._parseOptions(result, oper)

      return result
    }
    default:
      break
    }

    ctx.rest(options, oper, ctx)

    return options
  }

  resetOptions (options, oper) {
    // const ctx = options.caller ? options.caller : this
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

  _create () {
    global.notSupportError('_create')
  }

  _retrieve () {
    global.notSupportError('_retrieve')
  }

  _update () {
    global.notSupportError('_update')
  }

  _delete () {
    global.notSupportError('_delete')
  }

  _parseOptions (options) {
    return options
  }

  _getBefore () {
    global.notSupportError('_getBefore')
  }

  _getAfter () {
    global.notSupportError('_getAfter')
  }

}

module.exports = DbAdapter
