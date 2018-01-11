const events = require('events')
const core = require('nblue-core')

const aq = core.aq
const betch = core.betch
const EventEmitter = events.EventEmitter
const Schemas = require('.././schema/schemas')

const NotSupportError =
  (method) => {
    throw new Error(
      `The current ${method} wasn't supportted by abstract class.`
    )
  }

// support CRUD opetions for one database system
class DbAdapter extends EventEmitter {

  constructor (connection, schema) {
    // check for arguments
    if (!connection) throw new ReferenceError('connection')
    if (!schema) throw new ReferenceError('schema')

    super()

    // init private variants
    this._schema = schema
    this._connection = connection
    this._validateBeforeSave = false
  }

  get Name () {
    // get instance of schema
    const schema = this.getSchema()

    // return model name from schema
    return schema.name
  }

  get Connection () {
    return this._connection
  }

  get Schema () {
    return this._schema
  }

  get ValidateBeforeSave () {
    return this._validateBeforeSave
  }
  set ValidateBeforeSave (val) {
    this._validateBeforeSave = val
  }

  create (body, options, callback) {
    // get model and wrap options
    const method = 'create'
    const model = this.getModel()
    const wrapOptions = { target: 'to' }
    const opts = {}

    // initialize creating options
    opts.autoIncrement = this.getAutoIncrement()
    if (!opts.multi) {
      opts.multi = Array.isArray(body)
    }

    // init creating options
    if (options && typeof options === 'object') {
      Object.assign(opts, options)
    }

    // define functions
    const setDefaultFunc = Schemas.setDefaultValues
    const validateFunc = this._validate.bind(this)
    const wrapFunc = this.wrapData.bind(this)
    const beforeFunc = this._getBefore.bind(this)
    const createFunc = this._create.bind(this)
    const afterFunc = this._getAfter.bind(this)

    // resolve result
    return aq.pcall(
      betch({
        _default: setDefaultFunc(body, model),
        body: wrapFunc(body, wrapOptions),
        _validate: (ctx) => validateFunc(ctx.body),
        _before: (ctx) => beforeFunc(method)(ctx.body),
        _create: (ctx, data) => createFunc(data, opts),
        _after: (ctx, data) => afterFunc(method)(data)
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
    const retrieveFunc = this._retrieve.bind(this)
    const beforeFunc = this._getBefore.bind(this)
    const afterFunc = this._getAfter.bind(this)

    // invoke retrieve method
    return aq.pcall(
      betch({
        _before: () => beforeFunc(method)(),
        _retrieve: () => retrieveFunc(filter, opts),
        _after: (cx, data) => afterFunc(method)(data)
      }),
      callback
    )
  }

  update (filter, modifier, options, callback) {
    // declare method, model and wrap options
    const method = 'update'
    const model = this.getModel()
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
    const wrapFunc = this.wrapData.bind(this)
    const validateFunc = this._validate.bind(this)
    const beforeFunc = this._getBefore.bind(this)
    const updateFunc = this._update.bind(this)
    const afterFunc = this._getAfter.bind(this)

    // generate options for update
    opts = this.resetOptions(opts, method, this)

    // invoke retrieve method
    return aq.pcall(
      betch({
        body: wrapFunc(newModifier, wrapOptions),
        _validate: (ctx) => validateFunc(ctx.body),
        _before: (ctx) => beforeFunc(method)(ctx.body),
        _update: (ctx, data) => updateFunc(newFilter, data, opts),
        _after: (ctx, data) => afterFunc(method)(data)
      }),
      callback
    )
  }

  delete (filter, options, callback) {
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
    const beforeFunc = this._getBefore.bind(this)
    const deleteFunc = this._delete.bind(this)
    const afterFunc = this._getAfter.bind(this)
    // const resolveFunc = aq.callback.bind(this)

    // invoke delete method
    return aq.pcall(
      betch({
        _before: () => beforeFunc(method)(),
        _delete: () => deleteFunc(newFilter, opts),
        _after: (cx, data) => afterFunc(method)(data)
      }),
      callback
    )
  }

  count (filter, callback) {
    // define method name for count
    const method = 'count'

    // bind functions
    const beforeFunc = this._getBefore.bind(this)
    const countFunc = this._retrieve.bind(this)
    const afterFunc = this._getAfter.bind(this)

    // invoke delete method
    return aq.pcall(
      betch({
        _before: () => afterFunc(method)(),
        _count: () => countFunc(filter, { method: 'count' }),
        _after: (cx, data) => afterFunc(method)(data)
      }),
      callback
    )
  }

  aggregate (filter, callback) {
    // define method name for aggregate
    const method = 'aggregate'

    // bind functions
    const beforeFunc = this._getBefore.bind(this)
    const aggregateFunc = this._retrieve.bind(this)
    const afterFunc = this._getAfter.bind(this)

    // invoke delete method
    return aq.pcall(
      betch({
        _before: () => afterFunc(method)(),
        _aggregate: () => aggregateFunc(filter, { method: 'aggregate' }),
        _after: (cx, data) => afterFunc(method)(data)
      }),
      callback
    )
  }

  get (id, options, callback) {
    // assign options to opts
    const opts = options || {}

    // define method name in opts
    opts.method = 'findOne'

    // create
    const filter = { _id: id }

    // call retrieve method with arguments
    return this.retrieve(filter, opts, callback)
  }

  autoValidate (data) {
    // get schema
    const schema = this.getSchema()

    // use self function to validate schema
    Schemas.validateSchema(data, schema)
  }

  getWrapper () {
    if (this._wrapper !== null) {
      return this._wrapper
    }

    return {
      name: this.Name,
      from: null,
      to: null
    }
  }

  getSchema () {
    return this._schema
  }

  getModel () {
    // get instance of schema for current model
    const schema = this.getSchema()

    // get model object from schema
    return Schemas.getModel(schema)
  }

  getOptions () {
    // get instance of schema for current model
    const schema = this.getSchema()

    // get model options from schema
    return schema ? schema.options : {}
  }

  getAutoIncrement () {
    // get options for current model
    const opts = this.getOptions() || {}

    // return auto increment for current model
    return opts.autoIncrement
  }

  wrapData (data, options) {
    // define recursion function to wrap data
    const wrapFunc = this.wrapData.bind(this)

    // call recursion for every item if data is an array
    if (Array.isArray(data)) {
      return data.map((item) => wrapFunc(item, options))
    }

    // generate option for wrap
    const opts = this.getOptions() || {}

    // assign methods in options to target
    if (opts.methods) {
      Object.
        keys(opts.methods).
        forEach((key) => {
          data[key] = opts.methods[key]
        })
    }

    // get instance of wrapper
    const wrapper = this.getWrapper()

    if (wrapper) {
      // set wrapper options with default target
      const wrapperOpts = { target: 'to' }

      // copy options to wrapper options
      Object.assign(wrapperOpts, options)

      // get target name from wrapper options
      const target = wrapperOpts.target

      if (wrapper[target]) {
        // get wrapper function from instance of wrapper
        const wrapperFunc = wrapper[target]

        // invoke if found warpper function
        if (wrapperFunc &&
            typeof wrapperFunc === 'function') {
          return wrapperFunc(data, wrapperOpts.keys)
        }
      }
    }

    // return current data
    return data
  }

  parseOptions (options, oper) {
    switch (oper) {
    case 'retrieve': {
      // declare
      let
        limit = null,
        pager = null,
        projection = null,
        skip = null,
        sort = null

      // get pager property from options
      if (options.page && options.pageSize) {
        pager = {
          page: options.page,
          size: options.pageSize
        }
      }

      // get projection property from options
      if (options && options.projection) {
        projection = options.projection
      } else if (projection === null) {
        projection = options && options.fields ? options.fields : null
      }

      // get limit property from options
      if (options.limit) limit = options.limit
      else if (options.top) limit = options.top

      // get skip property from options
      if (options.skip) skip = options.skip

      // process projection
      if (projection !== null && Array.isArray(projection)) {
        const newFields = {}

        projection.forEach((field) => {
          newFields[field] = 1
        })

        projection = newFields
      }

      // get sort property from options
      if (options && options.sort) {
        sort = options.sort
      }

      // re-create opts for options
      const opts = {
        limit,
        pager,
        projection,
        skip,
        sort
      }

      // call private parse function if it was defined
      if (this._parseOptions) {
        this._parseOptions(opts, oper)
      }

      return opts
    }
    default:
      return options
    }
  }

  resetOptions (options, oper) {
    // create target opts
    const opts = {}

    // copy items from options to opts
    Object.assign(opts, options)

    // remove caller property from opts
    if (opts.caller) Reflect.deleteProperty(opts, 'caller')

    switch (oper) {
    case 'retrieve': {
      // remove some keys from opts
      [
        'projection',
        'page',
        'pageSize',
        'top',
        'method'
      ].
        forEach(
          (key) => Reflect.deleteProperty(opts, key)
        )
      break
    }
    default:
      break
    }

    return opts
  }

  _create () {
    NotSupportError('_create')
  }

  _retrieve () {
    NotSupportError('_retrieve')
  }

  _update () {
    NotSupportError('_update')
  }

  _delete () {
    NotSupportError('_delete')
  }

  _validate (data) {
    const that = this

    if (!that.ValidateBeforeSave) return

    const opts = that.getOptions()
    const validateFunc =
        opts.validate && typeof opts.validate === 'function'
          ? opts.validate.bind(that)
          : that.autoValidate.bind(that)

    validateFunc(data)
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

  _toObject (data) {
    const result = {}

    Object.
      keys(data).
      forEach((key) => {
        if (typeof data[key] === 'function') return

        result[key] = data[key]
      })

    return result
  }

}

module.exports = DbAdapter
