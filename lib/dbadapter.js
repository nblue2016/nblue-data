require('nblue-core')
const EventEmitter = require('events').EventEmitter

// support CRUD opetions for one database
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

  getContext (caller) {
    return caller ? caller : this
  }

  create (body, callback) {
    const ctx = this
    const newBody = ctx.getBody(body, { target: 'to' })
    const autoIncrement = ctx.getAutoIncrement()

    // decare
    let promiseFunc = null

    // define create callbck function
    const invokeFunc =
      (model, resolver) => ctx.pcreate(model, newBody, resolver)

    const resultFunc = ctx.getResultFunc('create', ctx)

    if (autoIncrement === null) {
      // creaet promise for callback function
      promiseFunc = ctx.createPromise(invokeFunc)

      // invoke create method if there is no auto increment field.
      return ctx.resolvePromise(promiseFunc, resultFunc, callback)
    }

    promiseFunc = ctx.pcreateWithIncrement

    // invoke createw with increase method if there is auto increment field.
    return ctx.
      resolvePromise(
        promiseFunc(newBody, autoIncrement, promiseFunc, invokeFunc),
        resultFunc,
        callback
      )
  }

  pcreate () {
    global.notSupportError('pcreate')
  }

  pcreateWithIncrement () {
    global.notSupportError('pcreateWithIncrement')
  }

  count (filter, callback) {
    const ctx = this

    return ctx.retrieve(filter, { method: 'count' }, callback)
  }

  retrieve (filter, options, callback) {
    const ctx = this
    const keyOfMethod = 'method'

    // convert string to object if argument is string
    const newFilter = typeof filter === 'string' ? JSON.parse(filter) : filter

    let newOptions = typeof options === 'string' ? JSON.parse(options) : options

    // get options
    if (!newOptions) newOptions = {}
    if (!newOptions.filter) newOptions.filter = newFilter

    // get method from options if it exist, other wise use default one
    const method = newOptions[keyOfMethod] ? newOptions[keyOfMethod] : 'find'

    const invokeFunc = (model, resolver) => {
      // check method
      if (!model[method] || typeof model[method] !== 'function') {
        throw new Error(`Can't find method: ${method}`)
      }

      // invoke method with options
      ctx.pretrieve(model, method, resolver, newOptions)
    }

    const promiseFunc = ctx.createPromise(invokeFunc)

    const resultFunc = ctx.getResultFunc('retrieve', ctx)

    return ctx.resolvePromise(promiseFunc, resultFunc, callback)
  }

  pretrieve () {
    global.notSupportError('pretrieve')
  }

  update (filter, modifier, callback) {
    const ctx = this

    const newFilter = typeof filter === 'string' ? JSON.parse(filter) : filter
    let newModifier =
        typeof modifier === 'string' ? JSON.parse(modifier) : modifier

    // get wrapper and process data before save
    const wrapper = ctx.getWrapper()

    if (wrapper && wrapper.to) {
      // get modified keys
      const modifiedKey = Object.keys(modifier)

      // wrap values before save
      newModifier = wrapper.to(newModifier, modifiedKey)
    }

    const invokeFunc =
      (model, resolver) => ctx.pupdate(model, resolver, newFilter, newModifier)

    const promiseFunc = ctx.createPromise(invokeFunc)

    const resultFunc = ctx.getResultFunc('update', ctx)

    return ctx.resolvePromise(promiseFunc, resultFunc, callback)
  }

  pupdate () {
    global.notSupportError('pupdate')
  }

  delete (filter, callback) {
    const ctx = this

    const newFilter = typeof filter === 'string' ? JSON.parse(filter) : filter

    const invokeFunc =
      (model, resolver) => ctx.pdelete(model, resolver, newFilter)

    const promiseFunc = ctx.createPromise(invokeFunc)

    const resultFunc = ctx.getResultFunc('delete', ctx)

    return ctx.resolvePromise(promiseFunc, resultFunc, callback)
  }

  pdelete () {
    global.notSupportError('pdelete')
  }

  createPromise (invokeFunc, caller) {
    const ctx = caller ? caller : this

    const model = ctx.getModel(ctx)

    return new Promise((resolve, reject) => {
      const callback = (err, data) => {
        if (err) reject(err)
        resolve(data)
      }

      invokeFunc(model, callback)
    })
  }

  resolvePromise (promise, resultFunc, callback) {
    return promise.
      then((data) => {
        // process result
        if (resultFunc) return resultFunc(data)

        return data
      }).
      then((data) => {
        if (callback) return callback(null, data)

        return data
      }).
      catch((err) => {
        if (callback) return callback(err, null)

        throw err
      })
  }

  createModel () {
    global.notSupportError('createModel')
  }

  getModel () {
    global.notSupportError('getModel')
  }

  getBody (body, options, caller) {
    const ctx = caller ? caller : this
    const target = options.target || null

    let newBody = body || {}

    if (typeof newBody === 'string') newBody = JSON.parse(newBody)

    // get wrapper and process data before save
    const wrapper = ctx.getWrapper(ctx)

    if (wrapper) {
      if (target && wrapper[target]) {
        const bindFunc = wrapper[target].bind(ctx, newBody)

        newBody = bindFunc()
      }
    }

    return newBody
  }

  getModelWithBody (body) {
    const ctx = this
    const Model = ctx.getModel(ctx)

    const model = new Model(body)

    return model
  }

  getModelFromSchema (caller, models) {
    const ctx = caller ? caller : this
    const name = ctx.Name

    if (!models.has(name)) {
      models.set(name, ctx.createModel(ctx))
    }

    return models.get(name)
  }

  getAutoIncrement (caller) {
    const ctx = caller ? caller : this
    const schema = ctx.getSchema(ctx)
    const options = schema.options

    return options && options.autoIncrement
      ? options.autoIncrement
      : null
  }

  getSchema () {
    global.notSupportError('getSchema')
  }

  getWrapper () {
    return {
      from: null,
      to: null
    }
  }

}

module.exports = DbAdapter
