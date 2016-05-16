const core = require('nblue-core')

const EventEmitter = require('events').EventEmitter
// const NotSupportError = ((method) => {throw new Error(`The current ${method} wasn't supportted by abstract class.`)})

// support CRUD opetions for one database
class DbAdapter extends EventEmitter
{
  constructor ()
  {
    super()

    this.validateBeforeSave = false
  }

  get ValidateBeforeSave () { return this.validateBeforeSave }
  set ValidateBeforeSave (val) { this.validateBeforeSave = val }

  create (name, body, callback)
  {
    const ctx = this

    // get instance of model by name
    const $model = ctx.getModel(name)

    // get instance of schema by name
    const $schema =  ctx.getSchema(name)

    body = (typeof body == 'string') ? JSON.parse(body) : body

    // get wrapper and process data before save
    const wrapper = ctx.getWrapper(name)
    if (wrapper && wrapper.to) {
      body = wrapper.to(body)
    }

    const autoIncrement
      = ($schema.options && $schema.options.autoIncrement)
        ? $schema.options.autoIncrement
        : undefined

    if (autoIncrement === undefined) {

      // invoke create method if there is no auto increment field.
      return ctx.invokeResolve(
                  ctx.createPromise(
                    $model,
                    wrapper,
                    (model, resolver) => ctx._create(model, body, resolver)
                  ),
                  undefined,
                  callback)
    }
    else {
      // invoke createw with increase method if there is auto increment field.
      return ctx.invokeResolve(
                  ctx._createWithIncrement(
                    $model,
                    body,
                    autoIncrement,
                    wrapper,
                    ctx._createWithIncrement,
                    (model, resolver) => ctx._create(model, body, resolver)
                  ),
                  undefined,
                  callback)
    }
  }

  _create (model, body, resolver)
  {
    NotSupportError('_create')
  }

  _createWithIncrement (model, entity, autoIncrement, wrapper, pending, callback)
  {
    NotSupportError('_increaseValue')
  }

  count (name, filter, callback)
  {
    const ctx = this

    return ctx.retrieve(name, fitler, { "countOnly": true }, callback)
  }

  retrieve (name, filter, options, callback)
  {
    const ctx = this

    // get instance of model by name
    const $model = ctx.getModel(name)

    // convert string to object if argument is string
    filter = (typeof(filter)  === 'string') ? JSON.parse(filter) : filter
    options = (typeof(options) === 'string') ? JSON.parse(options) : options

    // get options
    if (!options) options = {}
    if (!options.filter) options.filter = filter

    // get method from options if it exist, other wise use default one
    const method = (options["method"]) ? options["method"] : 'find'

    const wrapper = ctx.getWrapper(name)

    return ctx.invokeResolve(
                ctx.createPromise(
                  $model,
                  wrapper,
                  (model, resolver) => {

                    // check method
                    if (!model[method] || typeof(model[method]) !== 'function') {
                      throw new Error(`Can't find method: ${method}`)
                    }

                    // invoke method with options
                    ctx._retrieve(model, method, resolver, options)
                  }
                ),
                undefined,
                callback)
  }

  _retrieve (model, method, resolver, options)
  {
    NotSupportError('_retrieve')
  }

  update (name, filter, modifier, callback)
  {
    const ctx = this

    filter = (typeof filter === 'string') ? JSON.parse(filter) : filter
    modifier = (typeof modifier === 'string') ? JSON.parse(modifier) : modifier

    // get instance of model by name
    const $model = ctx.getModel(name)

    // get wrapper and process data before save
    const wrapper = ctx.getWrapper(name)
    if (wrapper && wrapper.to) {
      // get modified keys
      const modifiedKey = Object.keys(modifier)

      // wrap values before save
      modifier = wrapper.to(modifier, modifiedKey)
    }

    return ctx.invokeResolve(
                ctx.createPromise(
                  $model,
                  wrapper,
                  (model, resolver) => ctx._update(model, resolver, filter, modifier)
                ),
                undefined,
                callback)
  }

  _update (model, resolver, filter, modifier)
  {
    NotSupportError('_update')
  }

  delete (name, filter, callback)
  {
    const ctx = this

    filter = (typeof filter === 'string') ? JSON.parse(filter) : filter

    const $model = ctx.getModel(name)
    return ctx.invokeResolve(
                ctx.createPromise(
                  $model,
                  null,
                  (model, resolver) => ctx._delete(model, resolver, filter)
                ),
                data => (data.result) ? data.result : data,
                callback)
  }

  _delete (model, resolver, filter)
  {
    NotSupportError('_update')
  }

  createPromise (model, wrapper, callback)
  {
    // re-assign
    const ctx = this

    return new Promise((resolve, reject) => {

      callback(model, (err, data) => {

        // reject error
        if (err) reject(err)

        // wrapper data
        if (wrapper && wrapper.from) {
          if (Array.isArray(data)) data.map(item => wrapper.from(item))
          else data = wrapper.from(data)
        }

        // resolve data
        return resolve(data)
      })
    })
  }

  invokeResolve (promise, wrapperData, callback)
  {
    return promise
            .then( data => (wrapperData) ? wrapperData(data) : data )
            .then( data => (callback) ? callback(null, data) : data )
            .catch( err => {
              if (callback) callback(err, null)
              throw err
            })
  }

  createModel (name)
  {
    NotSupportError('createModel')
  }

  getModel (name)
  {
    NotSupportError('getModel')
  }

  getModelWithBody (name, body)
  {
    const ctx = this

    const Model = ctx.getModel(name)
    const model = new Model(body)

    return model
  }

  getSchema (name)
  {
    NotSupportError('getSchema')
  }

  getWrapper (name)
  {
    return { "from": null, "to": null }
  }
}

module.exports = DbAdapter
