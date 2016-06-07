const fs = require('fs')
const path = require('path')

const aq = global.aq

let staticInstance = null

class SchemaCache
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
      staticInstance = new SchemaCache()
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

        items.isArray = false

        if (!modelItems) {
          items.type = 'String'
        } else if (Array.isArray(modelItems)) {
          items.isArray = true

          if (modelItems.length === 0) {
            items.type = 'string'
          } else if (typeof modelItems[0] === 'object') {
            items.type = 'object'
          } else {
            items.type = modelItems[0]
          }
        } else if (typeof modelItems === 'object') {
          if (!modelItems.type) {
            newModel[key] = ctx.convertModel(modelItems)

            return
          }

          items.type = modelItems.type ? modelItems.type : 'String'
          if (modelItems.default) items.default = modelItems.default
          if (modelItems.limit) items.limit = modelItems.limit
        } else {
          items.type = modelItems
        }

        newModel[key] = items
      })

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
    // const schema = ctx.getSchema(entityName)
    const model = ctx.getModel(entityName)

    const modelKeys = Object.keys(model)
    const keys = Object.keys(entity)


    keys.forEach((key) => {
      // check keys
      if (!modelKeys.includes(key)) {
        throw new Error(`Can't find ${key} in model`)
      }

      const val = entity[key]
      const modelItems = model[key]

      if (!(val && modelItems.type)) return

      const type = modelItems.type.toLowerCase()

      if (modelItems.isArray) {
        if (!Array.isArray(val)) {
          throw new Error('Invaild array type')
        }

        val.forEach((item) => ctx.verifyType(key, item, type))
      } else {
        // const type = modelItems.type.toLowerCase()
        ctx.verifyType(key, val, type)
      }
    })
  }

  verifyType (key, val, type) {
    switch (type) {
    case 'string':
      if (typeof val !== 'string') throw new Error('invalid string')
      break
    case 'number':
      try {
        Number.parseFloat(val)
      } catch (err) {
        throw new Error(`ivalid number value for ${key}`)
      }
      break
    case 'date':
      try {
        Date.parse(val)
      } catch (err) {
        throw new Error(`ivalid date value for ${key}`)
      }
      break
    case 'object':
      break
    default:
      throw new Error(`Doesn't support type: ${type} of key: ${key}`)
    }
  }

}

module.exports = SchemaCache
