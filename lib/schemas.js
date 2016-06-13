const fs = require('fs')
const path = require('path')
const ValidatorError = require('./error/validator')

const aq = global.aq
const nanError = new Error('NaN value')

let staticInstance = null

class Schemas
{

  constructor () {
    this._cache = new Map()
    this._models = new Map()
  }

  get Cache () {
    return this._cache
  }

  get Models () {
    return this._models
  }

  static create () {
    if (staticInstance === null) {
      staticInstance = new Schemas()
    }

    return staticInstance
  }

  define (file, callback) {
    const ctx = this

    return aq.
      statFile(file).
      then(() => aq.readFile(file, { encoding: 'utf-8' })).
      then((data) => {
        ctx.readSchemas(data, ctx.getExtName(file), ctx)

        return callback ? callback(null) : Promise.resolve(null)
      }).
      catch((err) => {
        if (callback) return callback(err)

        return Promise.reject(err)
      })
  }

  defineSync (file) {
    const ctx = this

    const data = fs.readFileSync(file, { encoding: 'utf-8' })

    ctx.readSchemas(data, ctx.getExtName(file), ctx)
  }

  getExtName (file) {
    const pathInfo = path.parse(file)

    let extName = pathInfo.ext ? pathInfo.ext : ''

    if (extName.indexOf('.') === 0) {
      extName = extName.substr(1, extName.length - 1)
    }

    return extName
  }

  readSchemas (data, ext, caller) {
    const ctx = caller ? caller : this

    switch (ext) {
    case 'json': {
      ctx.defineSchemas(JSON.parse(data))
      break
    }
    case 'js':
    case '_js': {
      const body = `(function() {\r\n return ${data} \r\n})()`

      ctx.defineSchemas(global.eval(body))
      break
    }
    default:
      throw new Error(`not support the extend name: ${ext}`)
    }
  }

  defineSchemas (schemas) {
    const ctx = this
    const cache = ctx.Cache
    const entity = schemas.entity ? schemas.entity : {}

    Object.
      keys(entity).
      map((entityName) => {
        const item = entity[entityName]
        const options = {}

        item.name = entityName

        // set default value for options
        options.database = (schemas.database || {}).default
        options.collection = entityName
        options.table = entityName

        Object.assign(options, item.options)

        item.database = options.database
        Reflect.deleteProperty(options, 'database')

        if (!item.model) item.model = {}
        item.options = options

        return item
      }).
      forEach((item) => cache.set(item.name, item))
  }

  getSchema (entityName) {
    const ctx = this
    const cache = ctx.Cache

    if (!cache.has(entityName)) {
      return null
    }

    return cache.get(entityName)
  }

  getModel (entityName, caller) {
    const ctx = caller ? caller : this

    if (!ctx.Models.has(entityName)) {
      // get schema from definition
      const schema = ctx.getSchema(entityName)

      // throw error if doesn't the schema by name
      if (!schema) throw new Error(`Can't find schema for ${entityName}`)

      // get model and save it to cache
      const model = ctx.convertModel(schema.model)

      if (!model) {
        throw new Error(`Can't find model for ${entityName}'s schema'`)
      }

      ctx.Models.set(entityName, model)
    }

    return ctx.Models.get(entityName)
  }

  convertModel (model) {
    const ctx = this
    const newModel = {}

    Object.
      keys(model).
      forEach((key) => {
        const modelItems = model[key]
        const items = {}

        // init default value for items
        items._isArray = false
        items._type = typeof modelItems === 'string' ? modelItems : 'string'
        items._require = false

        if (Array.isArray(modelItems)) {
          items._isArray = true

          if (modelItems.length === 0) {
            items._type = 'string'
          } else if (typeof modelItems[0] === 'object') {
            items._type = 'object'
          } else {
            items._type = modelItems[0]
          }
        } else if (typeof modelItems === 'object') {
          if (!modelItems.type) {
            // see it as a sub-item and to convert it
            newModel[key] = ctx.convertModel(modelItems)
            newModel[key]._type = 'object'

            return
          }


          if (modelItems.type) items._type = modelItems.type
          if (modelItems.require) items._require = modelItems.require
          if (modelItems.default) items._default = modelItems.default
          if (modelItems.limit) items._limit = modelItems.limit
        }

        newModel[key] = items
      })

    // console.log(newModel)
    return newModel
  }

  getWrapper (entityName) {
    const ctx = this
    const schema = ctx.getSchema(entityName)
    const options = schema.options || {}

    return options.wrapper ? options.wrapper : null
  }

  verifySchema (entityName, entity) {
    const ctx = this
    const schema = ctx.getSchema(entityName)
    const model = ctx.getModel(entityName)

    const methodKeys = Object.keys(
      schema.options && schema.options.methods
        ? schema.options.methods
        : {}
      )

    ctx.verifyEntity(entity, model, { ignoreKeys: methodKeys })
  }

  verifyEntity (entity, model, options) {
    const ctx = options && options.caller ? options.caller : this
    const base = options && options.base ? options.base : ''
    const ignoreKeys =
      options && options.ignoreKeys ? options.ignoreKeys : ['_type']

    const modelKeys = Object.keys(model)
    const keys = Object.keys(entity)

    const newOptions = {}

    newOptions.caller = ctx
    newOptions.base = base

    // check for required fields
    modelKeys.
      filter((key) => model[key] && model[key]._require).
      forEach((key) => {
        if (!(keys.includes(key) || entity[key])) {
          throw ValidatorError.create(key, 'current key is required')
        }
      })

    keys.forEach((key) => {
      if (ignoreKeys && ignoreKeys.includes(key)) return

      const baseKey = base === '' ? key : `${base}.${key}`

      // check keys
      if (!modelKeys.includes(key)) {
        throw ValidatorError.create(
          baseKey, 'Can\'t find the key defined in model')
      }

      const val = entity[key]
      const modelItems = model[key]

      if (!(val && modelItems._type)) return
      if (modelItems._limit) {
        if (Array.isArray(modelItems._limit)) {
          if (!modelItems._limit.includes(val)) {
            throw ValidatorError.create(
              baseKey, 'The value doesn\'t in limit')
          }
        }
      }

      const type = modelItems._type.toLowerCase()

      if (modelItems._isArray) {
        if (!Array.isArray(val)) {
          throw ValidatorError.create(baseKey, 'Invalid array type')
        }

        val.forEach((item) => {
          if (type === 'object') {
            ctx.verifyEntity(item, model[key], newOptions)
          } else {
            ctx.verifyType(key, item, type, newOptions)
          }
        })
      } else if (type === 'object') {
        newOptions.base = key
        ctx.verifyEntity(entity[key], model[key], newOptions)
      } else {
        ctx.verifyType(key, val, type, newOptions)
      }
    })
  }

  verifyType (key, val, type, options) {
    // const ctx = options && options.caller ? options.caller : this
    const base = options && options.base ? options.base : ''
    const baseKey = base === '' ? key : `${base}.${key}`

    switch (type) {
    case 'string':
      if (typeof val !== 'string') {
        throw ValidatorError.create(baseKey, 'invalid string value')
      }
      break
    case 'number':
      try {
        const floatVal = Number.parseFloat(val)

        if (isNaN(floatVal)) {
          throw nanError
        }
      } catch (err) {
        throw ValidatorError.create(baseKey, 'invalid number value')
      }
      break
    case 'date':
      try {
        const dateVal = Date.parse(val)

        if (isNaN(dateVal)) {
          throw nanError
        }
      } catch (err) {
        throw ValidatorError.create(baseKey, 'invalid date value')
      }
      break
    case 'object':
      break
    default:
      throw ValidatorError.create(
        baseKey, `doesn't support current type: ${type}`)
    }
  }

  setDefaultValues (entity, model) {
    const ctx = this

    if (Array.isArray(entity)) {
      entity.
        forEach(
          (item) => ctx.setDefaultValues(item, model)
        )

      return
    }

    // const schema = ctx.getSchema(caller)
    // const model = schema.model || {}
    const innerFunc = (imodel, idata) => {
      Object.
        keys(imodel).
        forEach((key) => {
          if (key.startsWith('_')) return
          if (idata[key]) return

          const modelDefined = imodel[key]

          if (typeof modelDefined === 'object') {
            if (modelDefined._default) {
              if (typeof modelDefined._default === 'function') {
                idata[key] = Reflect.apply(modelDefined._default, idata, [])
              } else {
                idata[key] = modelDefined._default
              }
            } else if (!idata[key]) {
              if (Array.isArray(imodel[key])) {
                idata[key] = []
              } else if (modelDefined._type === 'object') {
                idata[key] = {}

                innerFunc(imodel[key], idata[key])

                if (Object.keys(idata[key]).length === 0) {
                  Reflect.deleteProperty(idata, key)
                }
              }
            }
          }
        })
    }

    innerFunc(model, entity)
  }

}

module.exports = Schemas
