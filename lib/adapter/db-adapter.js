const EventEmitter = require('events').EventEmitter
const nblue = require('nblue-core')

const aq = nblue.aq
const betch = nblue.betch

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
    if (!connection) throw new Error('invalid connection')
    if (!schema) throw new Error('invalid name')

    super()

    // init private variants
    this._schema = schema
    this._connection = connection
    this._validateBeforeSave = false
  }

  get Name () {
    const that = this
    const schema = that.getSchema()

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
    const setDefaultFunc = Schemas.setDefaultValues
    const validateFunc = that._validate.bind(that)
    const wrapFunc = that.wrapData.bind(that)
    const beforeFunc = that._getBefore.bind(that)
    const createFunc = that._create.bind(that)
    const afterFunc = that._getAfter.bind(that)
    const resolveFunc = aq.callback.bind(that)

    // resolve result
    return aq.pcall(
      betch({
        _default: setDefaultFunc(body, model),
        body: wrapFunc(body, wrapOptions),
        _validate: (cx) => validateFunc(cx.body),
        _before: (cx) => beforeFunc(method)(cx.body),
        _create: (cx, data) => createFunc(data, opts),
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
    const resolveFunc = aq.callback.bind(that)

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
    const resolveFunc = aq.callback.bind(that)

    opts = that.resetOptions(opts, method, that)

    // invoke retrieve method
    return aq.pcall(
      betch({
        body: wrapFunc(newModifier, wrapOptions),
        _validate: (cx) => validateFunc(cx.body),
        _before: (cx) => beforeFunc(method)(cx.body),
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
    const resolveFunc = aq.callback.bind(that)

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
    const that = this
    const method = 'count'

    // bind functions
    const beforeFunc = that._getBefore.bind(that)
    const countFunc = that._retrieve.bind(that)
    const afterFunc = that._getAfter.bind(that)
    const resolveFunc = aq.callback.bind(that)

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
    const that = this
    const method = 'count'

    // bind functions
    const beforeFunc = that._getBefore.bind(that)
    const aggregateFunc = that._retrieve.bind(that)
    const afterFunc = that._getAfter.bind(that)
    const resolveFunc = aq.callback.bind(that)

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
    const that = this
    const opts = options || {}
    const filter = {}

    opts.method = 'findOne'
    filter._id = id

    return that.retrieve(filter, opts, callback)
  }

  autoValidate (data) {
    const that = this

    // get schema
    const schema = that.getSchema()

    // use self function to validate schema
    Schemas.validateSchema(data, schema)
  }

  getWrapper () {
    const that = this

    if (that._wrapper !== null) {
      return that._wrapper
    }

    return {
      name: that.Name,
      from: null,
      to: null
    }
  }

  getSchema () {
    const that = this

    return that._schema
  }

  getModel () {
    const that = this
    const schema = that.getSchema()

    return Schemas.getModel(schema)
  }

  getOptions () {
    const that = this
    const schema = that.getSchema()

    return schema ? schema.options : {}
  }

  getAutoIncrement () {
    const that = this
    const opts = that.getOptions()

    return opts && opts.autoIncrement
      ? opts.autoIncrement
      : null
  }

  wrapData (data, options) {
    const that = this

    if (Array.isArray(data)) {
      return data.map((item) => that.wrapData(item, options))
    }

    const opts = that.getOptions()

    if (opts && opts.methods) {
      Object.
          keys(opts.methods).
          forEach((key) => {
            data[key] = opts.methods[key]
          })
    }

    const wrapper = that.getWrapper ? that.getWrapper() : null

    if (wrapper) {
      const opts2 = {}

      opts2.target = 'to'
      Object.assign(opts2, options)

      if (wrapper[opts2.target]) {
        const wrapperFunc = wrapper[opts2.target]

        return wrapperFunc(data, opts2.keys)
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
        skip = null,
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

      if (options.skip) skip = options.skip

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

      const opts = {}

      opts.limit = limit
      opts.pager = pager
      opts.projection = projection
      opts.skip = skip
      opts.sort = sort

      that._parseOptions(opts, oper)

      return opts
    }
    default:
      break
    }

    that.rest(options, oper, that)

    return options
  }

  resetOptions (options, oper) {
    const opts = {}

    Object.assign(opts, options)
    if (opts.caller) Reflect.deleteProperty(opts, 'caller')

    switch (oper) {
    case 'retrieve': {
      ['projection', 'page', 'pageSize', 'top', 'method'].
      forEach((key) => Reflect.deleteProperty(opts, key))
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
