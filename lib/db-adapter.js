require('nblue-core')
const SchemaCache = require('./schema-cache')
const EventEmitter = require('events').EventEmitter

const schemas = SchemaCache.create()

// support CRUD opetions for one database system
class DbAdapter extends EventEmitter {

  constructor (... args) {
    super()

    this._name = args.length > 0 ? args[0] : ''
    this._validateBeforeSave = false
  }

  get Name () {
    return this._name
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

    const newBody = ctx.wrapData(body, { target: 'to' }, ctx)

    // init creating options
    if (options &&
      typeof options === 'object' && !callback) {
      Object.assign(newOptions, options)
    }

    // invoke create method if there is no auto increment field.
    return ctx.
        resolvePromise(
          ctx.createPromise(ctx._create(newBody, newOptions)),
          ctx._getAfter('create', ctx),
          ctx.getCallback(options, callback)
        )
  }

  retrieve (filter, options, callback) {
    const ctx = this
    const retrOptions = {}

    // init retrieving options
    retrOptions.caller = ctx
    if (options &&
      typeof options === 'object' && !callback) {
      Object.assign(retrOptions, options)
    }

    // invoke create method if there is no auto increment field.
    return ctx.
        resolvePromise(
          ctx.createPromise(ctx._retrieve(filter, retrOptions)),
          ctx._getAfter('retrieve', ctx),
          ctx.getCallback(options, callback)
        )
  }

  update (filter, modifier, options, callback) {
    const ctx = this
    const updateOptions = {}

    // init updating options
    updateOptions.caller = ctx
    updateOptions.multi = true
    if (options &&
      typeof options === 'object' && !callback) {
      Object.assign(updateOptions, options)
    }

    let
      newFilter = filter,
      newModifier = modifier

    if (typeof newFilter === 'string') newFilter = JSON.parse(newFilter)
    if (typeof newModifier === 'string') newModifier = JSON.parse(newModifier)

    // get wrapper and process data before save
    newModifier = ctx.wrapData(newModifier, {
      target: 'to',
      keys: Object.keys(modifier)
    })

    // invoke create method if there is no auto increment field.
    return ctx.
        resolvePromise(
          ctx.createPromise(
            ctx._update(newFilter, newModifier, updateOptions)
          ),
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
    if (options &&
      typeof options === 'object' && !callback) {
      Object.assign(deleteOptions, options)
    }

    const newFilter = typeof filter === 'string' ? JSON.parse(filter) : filter

    // invoke create method if there is no auto increment field.
    return ctx.
        resolvePromise(
          ctx.createPromise(
            ctx._delete(newFilter, deleteOptions)
          ),
          ctx._getAfter('delete', ctx),
          ctx.getCallback(options, callback)
        )
  }

  count (filter, callback) {
    const ctx = this

    return ctx.retrieve(filter, { method: 'count' }, callback)
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

  getWrapper (caller) {
    const ctx = caller ? caller : this

    return {
      name: ctx.Name,
      from: null,
      to: null
    }
  }

  getSchema (caller) {
    const ctx = caller ? caller : this
    const name = ctx.Name

    return schemas.getSchema(name)
  }

  getAutoIncrement (caller) {
    const ctx = caller ? caller : this
    const schema = ctx.getSchema(ctx)
    const options = schema.options

    return options && options.autoIncrement
      ? options.autoIncrement
      : null
  }

  wrapData (data, options, caller) {
    const ctx = caller ? caller : this

    if (Array.isArray(data)) {
      return data.map((item) => ctx.wrapData(item, options, ctx))
    }

    const wrapper = ctx.getWrapper(ctx)

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

  _getBefore () {
    global.notSupportError('_getBefore')
  }

  _getAfter () {
    global.notSupportError('_getAfter')
  }

}

module.exports = DbAdapter
