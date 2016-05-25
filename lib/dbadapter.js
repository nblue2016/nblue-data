require('nblue-core')
const EventEmitter = require('events').EventEmitter

// support CRUD opetions for one database
class DbAdapter extends EventEmitter {

  constructor () {
    super()

    this.validateBeforeSave = false
  }

  get ValidateBeforeSave () {
    return this.validateBeforeSave
  }
  set ValidateBeforeSave (val) {
    this.validateBeforeSave = val
  }

  create (name, body, callback) {
    const ctx = this

    // get instance of model by name
    const $model = ctx.getModel(name)

    // get instance of schema by name
    const $schema = ctx.getSchema(name)

    let newBody = typeof body === 'string' ? JSON.parse(body) : body

    // get wrapper and process data before save
    const wrapper = ctx.getWrapper(name)

    if (wrapper && wrapper.to) {
      newBody = wrapper.to(newBody)
    }

    const autoIncrement =
      $schema.options && $schema.options.autoIncrement
        ? $schema.options.autoIncrement
        : null

    if (autoIncrement === null) {
      // invoke create method if there is no auto increment field.
      const result = ctx.invokeResolve(
                  ctx.createPromise(
                    $model,
                    wrapper,
                    (model, resolver) => ctx.pcreate(model, newBody, resolver)
                  ),
                  null,
                  callback)

      return result
    }


    // invoke createw with increase method if there is auto increment field.
    return ctx.invokeResolve(
                ctx.pcreateWithIncrement(
                  $model,
                  body,
                  autoIncrement,
                  wrapper,
                  ctx.pcreateWithIncrement,
                  (model, resolver) => ctx.pcreate(model, body, resolver)
                ),
                null,
                callback)
  }

  // _create (model, body, resolver)
  pcreate () {
    global.notSupportError('pcreate')
  }

  pcreateWithIncrement () {
    global.notSupportError('pcreateWithIncrement')
  }

  count (name, filter, callback) {
    const ctx = this

    return ctx.retrieve(name, filter, { countOnly: true }, callback)
  }

  retrieve (name, filter, options, callback) {
    const ctx = this
    const keyOfMethod = 'method'

    // get instance of model by name
    const $model = ctx.getModel(name)

    // convert string to object if argument is string
    const newFilter = typeof filter === 'string' ? JSON.parse(filter) : filter

    let newOptions = typeof options === 'string' ? JSON.parse(options) : options

    // get options
    if (!newOptions) newOptions = {}
    if (!newOptions.filter) newOptions.filter = newFilter

    // get method from options if it exist, other wise use default one
    const method = newOptions[keyOfMethod] ? newOptions[keyOfMethod] : 'find'

    const wrapper = ctx.getWrapper(name)

    return ctx.invokeResolve(
                ctx.createPromise(
                  $model,
                  wrapper,
                  (model, resolver) => {
                    // check method
                    if (!model[method] || typeof model[method] !== 'function') {
                      throw new Error(`Can't find method: ${method}`)
                    }

                    // invoke method with options
                    ctx.pretrieve(model, method, resolver, newOptions)
                  }
                ),
                null,
                callback)
  }

  // _retrieve (model, method, resolver, options)
  pretrieve () {
    global.notSupportError('pretrieve')
  }

  update (name, filter, modifier, callback) {
    const ctx = this

    const newFilter = typeof filter === 'string' ? JSON.parse(filter) : filter
    let newModifier =
        typeof modifier === 'string' ? JSON.parse(modifier) : modifier

    // get instance of model by name
    const $model = ctx.getModel(name)

    // get wrapper and process data before save
    const wrapper = ctx.getWrapper(name)

    if (wrapper && wrapper.to) {
      // get modified keys
      const modifiedKey = Object.keys(modifier)

      // wrap values before save
      newModifier = wrapper.to(newModifier, modifiedKey)
    }

    return ctx.invokeResolve(
      ctx.createPromise(
        $model,
        wrapper,
        (model, resolver) =>
          ctx.pupdate(model, resolver, newFilter, newModifier)
      ),
      null,
      callback)
  }

  // _update (model, resolver, filter, modifier)
  pupdate () {
    global.notSupportError('pupdate')
  }

  delete (name, filter, callback) {
    const ctx = this

    const newFilter = typeof filter === 'string' ? JSON.parse(filter) : filter

    const $model = ctx.getModel(name)

    return ctx.invokeResolve(
                ctx.createPromise(
                  $model,
                  null,
                  (model, resolver) => ctx.pdelete(model, resolver, newFilter)
                ),
                (data) => {
                  if (data.result) return data.result

                  return data
                },
                callback)
  }

  // _delete (model, resolver, filter)
  pdelete () {
    global.notSupportError('pdelete')
  }

  createPromise (model, wrapper, callback) {
    return new Promise((resolve, reject) => {
      callback(model, (err, data) => {
        let newData = data

        // reject error
        if (err) reject(err)

        // wrapper data
        if (wrapper && wrapper.from) {
          if (Array.isArray(newData)) {
            newData.map((item) => wrapper.from(item))
          } else {
            newData = wrapper.from(newData)
          }
        }

        // resolve data
        return resolve(newData)
      })
    })
  }

  invokeResolve (promise, wrapperData, callback) {
    return promise.
      then((data) => {
        if (wrapperData) return wrapperData(data)

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

  // createModel (name)
  createModel () {
    global.notSupportError('createModel')
  }

  // getModel (name)
  getModel () {
    global.notSupportError('getModel')
  }

  getModelWithBody (name, body) {
    const ctx = this

    const Model = ctx.getModel(name)

    const model = new Model(body)

    return model
  }

  // getSchema (name)
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
