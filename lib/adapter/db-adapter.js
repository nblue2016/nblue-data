const EventEmitter = require('events').EventEmitter
const nblue = require('nblue')
const Schemas = require('.././schema/schemas')

const aq = nblue.aq
const betch = nblue.betch
const IIf = global.IIf

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

/*
  getCallback (options, callback) {
    if (typeof options === 'function' && !callback) {
      return options
    }

    return callback
  }
*/

  create (body, options, callback) {
    const that = this

    // get model and wrap options
    const method = 'create'
    const model = that.getModel()
    const wrapOptions = { target: 'to' }

    const opts = {}

    // initialize creating options
    opts.autoIncrement = that.getAutoIncrement()
    if (!opts.multi) {
      opts.multi = Array.isArray(body)
    }

    // init creating options
    if (options && typeof options === 'object') {
      Object.assign(opts, options)
    }

    // define functions
    const defaultFunc = Schemas.setDefaultValues
    const validateFunc = that._validate.bind(that)
    const wrapFunc = that.wrapData.bind(that)
    const beforeFunc = that._getBefore.bind(that)
    const createFunc = that._create.bind(that)
    const afterFunc = that._getAfter.bind(that)
    const resolveFunc = that._resolveResult.bind(that)

    // resolve result
    return resolveFunc(
      betch({
        _default: defaultFunc(body, model),
        wrap: wrapFunc(body, wrapOptions),
        _validate: (cx) => validateFunc(cx.wrap),
        _before: (cx) => beforeFunc(method)(cx.wrap),
        create: (cx, data) => createFunc(data, opts),
        _after: (cx, data) => afterFunc(method)(data)
      }),
      callback
    )
  }

  retrieve (filter, options, callback) {
    const that = this

    // declare method and options
    const method = 'retrieve'
    const opts = {}

    // init retrieving options
    if (options && typeof options === 'object') {
      Object.assign(opts, options)
    }

    // bind functions
    const retrieveFunc = that._retrieve.bind(that)
    const beforeFunc = that._getBefore.bind(that)
    const afterFunc = that._getAfter.bind(that)
    const resolveFunc = that._resolveResult.bind(that)

    // invoke retrieve method
    return resolveFunc(
      betch({
        _before: () => beforeFunc(method)(),
        _retrieve: () => retrieveFunc(filter, opts),
        _after: (cx, data) => afterFunc(method)(data)
      }),
      callback
    )
  }

  update (filter, modifier, options, callback) {
    const that = this

    // declare method, model and wrap options
    const method = 'update'
    const model = that.getModel()
    const wrapOptions = {
      target: 'to',
      keys: Object.keys(modifier)
    }

    let
      newFilter = filter,
      newModifier = modifier,
      opts = {}

    // initialize update options
    opts.multi = true
    if (options && typeof options === 'object') {
      Object.assign(opts, options)
    }

    // reset filter and modifier
    if (typeof newFilter === 'string') newFilter = JSON.parse(newFilter)
    if (typeof newModifier === 'string') newModifier = JSON.parse(newModifier)

    // define functions
    const wrapFunc = that.wrapData.bind(that)
    const validateFunc = that._validate.bind(that)
    const beforeFunc = that._getBefore.bind(that)
    const updateFunc = that._update.bind(that)
    const afterFunc = that._getAfter.bind(that)
    const resolveFunc = that._resolveResult.bind(that)

    opts = that.resetOptions(opts, method, that)

    // invoke retrieve method
    return resolveFunc(
      betch({
        wrap: wrapFunc(newModifier, wrapOptions),
        _validate: (cx) => validateFunc(cx.wrap),
        _before: (cx) => beforeFunc(method)(cx.wrap),
        _update: (cx, data) => updateFunc(newFilter, data, opts),
        _after: (cx, data) => afterFunc(method)(data)
      }),
      callback
    )
  }

  delete (filter, options, callback) {
    const that = this

    // declare method and options
    const method = 'delete'
    const opts = {}

    opts.multi = true

    // init deleting options
    if (options && typeof options === 'object') {
      Object.assign(opts, options)
    }

    const newFilter = typeof filter === 'string' ? JSON.parse(filter) : filter

    // bind functions
    const beforeFunc = that._getBefore.bind(that)
    const deleteFunc = that._delete.bind(that)
    const afterFunc = that._getAfter.bind(that)
    const resolveFunc = that._resolveResult.bind(that)

    // invoke delete method
    return resolveFunc(
      betch({
        _before: () => afterFunc(method)(),
        _delete: () => deleteFunc(newFilter, opts),
        _after: (cx, data) => afterFunc(method)(data)
      }),
      callback
    )
  }

  count (filter, callback) {
    const that = this
    const method = 'count'

    // bind functions
    const beforeFunc = that._getBefore.bind(that)
    const countFunc = that._retrieve.bind(that)
    const afterFunc = that._getAfter.bind(that)
    const resolveFunc = that._resolveResult.bind(that)

    // invoke delete method
    return resolveFunc(
      betch({
        _before: () => afterFunc(method)(),
        _count: () => countFunc(filter, { method: 'count' }),
        _after: (cx, data) => afterFunc(method)(data)
      }),
      callback
    )
  }

  _validate (data) {
    const that = this

    if (!that.ValidateBeforeSave) return

    const options = that.getOptions()

    const validateFunc =
      options.validate && typeof options.validate === 'function'
      ? options.validate.bind(that)
      : that.autoValidate

    validateFunc(data)
  }

  autoValidate (data) {
    const that = this

    // get schema
    const schema = that.getSchema(that)

    // use self function to validate schema
    Schemas.validateEntityBySchema(data, schema)
  }

  createPromise (invokeFunc) {
    return new Promise((resolve, reject) => {
      const cb =
        (err, data) => {
          if (err) reject(err)
          else resolve(data)
        }

      invokeFunc(cb)
    })
  }

/*
  resolvePromise (pending, afterFunc, callback) {
    const cb = callback ? callback : () => null

    return pending.
      then((data) =>
        IIf(afterFunc, afterFunc(data), data)
      ).
      then((data) =>
        IIf(callback, cb(null, data), data)
      ).
      catch((err) =>
        IIf(callback, cb(err, null), Promise.reject(err))
      )
  }
*/

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

  getOptions () {
    const ctx = this
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
    const that = this
    // const ctx = caller ? caller : this

    if (Array.isArray(data)) {
      return data.map((item) => that.wrapData(item, options))
    }

    const dataOptions = that.getOptions()

    if (dataOptions && dataOptions.methods) {
      Object.
          keys(dataOptions.methods).
          forEach((key) => {
            data[key] = dataOptions.methods[key]
          })
    }

    const wrapper = that.getWrapper ? that.getWrapper() : null

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
    const that = this

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

      that._parseOptions(result, oper)

      return result
    }
    default:
      break
    }

    that.rest(options, oper, that)

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
    return (data) => data
  }

  _getAfter () {
    return (data) => data
  }

  _resolveResult (pending, callback) {
    return pending.
      then((data) => {
        if (callback) return callback(null, data)

        return data
      }).
      catch((err) => {
        if (err) return callback(err, null)

        return Promise.reject(err)
      })
  }

}

module.exports = DbAdapter
