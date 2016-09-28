const fs = require('fs')
const path = require('path')
const nblue = require('nblue')
const aq = nblue.aq
const betch = nblue.betch

const TypeError = require('.././error/type')
const ValidatorError = require('.././error/validator')

let
  getRegex = null,
  staticInstance = null

const range = function (min, max) {
  return function (val) {
    if (val < min || val > max) return false

    return true
  }
}
const predefine = function (macro) {
  const regex = getRegex(macro)

  return function (val) {
    if (regex === null) return false

    return regex.test(val)
  }
}
const nanError = new Error('NaN value')

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

  static getMacro (name) {
    switch (name) {
    case '@email':
      return /[A-Z0-9._%+-]+@[A-Z0-9-]+.+.[A-Z]{2,4}/igm
    default:
      return null
    }
  }

  readFile (file, callback) {
    const that = this

    const workflow = {
      _r1: aq.statFile(file),
      _r2: aq.readFile(file, { encoding: 'utf-8' }),
      _r3: (ctx, data) =>
        that.parseFile(data, that.getExtName(file))
    }

    if (!callback) return betch(workflow)

    return betch(workflow).
      then((data) => callback(null, data)).
      catch((err) => callback(err, null))
  }

  readFileSync (file) {
    const that = this
    const data = fs.readFileSync(file, { encoding: 'utf-8' })

    that.parseFile(data, that.getExtName(file))
  }

  getExtName (file) {
    const pathInfo = path.parse(file)

    let extName = pathInfo.ext ? pathInfo.ext : ''

    if (extName.indexOf('.') === 0) {
      extName = extName.substr(1, extName.length - 1)
    }

    return extName
  }

  parseFile (data, type) {
    switch (type) {
    case 'json': {
      this.parseSchemas(JSON.parse(data))
      break
    }
    case 'js':
    case '_js': {
      // const body = `(function() {\r\n return ${data} \r\n})()`
      const schemas = (val) => val

      this.parseSchemas(eval(data))

      break
    }
    default:
      throw new Error(`not support the extend name: ${type}`)
    }
  }

  parseSchemas (data, caller) {
    const that = caller ? caller : this
    const cache = that.Cache

    Object.
      keys(data).
      filter((name) => !name.startsWith('$')).
      map((name) => {
        // convert every item
        const item = data[name]
        const options = {}

        // set default value for options
        options.database = (data.$database || {}).default
        options.collection = name
        options.table = name

        // copy value that defined in options to current item
        Object.assign(options, item.options)

        // set properies for item
        item.name = name
        item.database = options.database
        if (!item.model) item.model = {}

        // remove database key from options
        Reflect.deleteProperty(options, 'database')

        const result = {}

        result.name = name
        result.database = item.database
        result.model = that.convertModel(item.model)
        result.options = options

        return result
      }).
      forEach((item) => cache.set(item.name, item))
  }

  getSchema (name) {
    const cache = this.Cache

    if (!cache.has(name)) {
      return null
    }

    return cache.get(name)
  }

  getModel (name) {
    const schema = this.getSchema(name)

    if (schema) return schema.model

    throw new Error(`can't find modle by name: ${name}`)
  }

  getType (val) {
    // define arraies
    const supportedTypeNames = [
      'string',
      'number',
      'integer',
      'float',
      'boolean',
      'date',
      'datetime',
      'object',
      'buffer',
      'blob'
    ]
    const supportedNativeNames = [
      'string',
      'number',
      'date',
      'boolean',
      'object',
      'buffer'
    ]

    if (val) {
      if (typeof val === 'string') {
        try {
          // get type name by string value
          const typeName = val.toLowerCase()

          // check supported types
          if (supportedTypeNames.indexOf(typeName) < 0) {
            throw new Error(`Unsupported type name: ${val}`)
          }

          return typeName
        } catch (err) {
          throw new TypeError(`${val}`, err.message)
        }
      } else if (typeof val === 'function') {
        // get type name by function name, use native type
        try {
          const funcName = val.name.toLowerCase()

          // check supported native types
          if (supportedNativeNames.indexOf(funcName) < 0) {
            throw new Error(`Unsupported function name: ${val.name}`)
          }

          return funcName
        } catch (err) {
          throw new TypeError(`${val}`, err.message)
        }
      } else if (typeof val === 'object') {
        // check default type name
        const keys = Object.
                      keys(val).
                      filter((key) => !key.startsWith('$'))

        // return object type if it contains element
        return keys.length > 0 ? 'object' : 'string'
      }
    }

    // return default type
    return 'string'
  }

  convertModel (model) {
    const that = this
    const newModel = {}

    Object.
      keys(model).
      forEach((key) => {
        const modelItems = model[key]
        const items = {}

        // init default value for items
        items.isArray = false
        items.type = 'string'
        items.require = false

        if (Array.isArray(modelItems)) {
          items.isArray = true
          items.type = that.getType(modelItems[0])
        } else {
          items.type =
            modelItems.$type
              ? that.getType(modelItems.$type)
              : that.getType(modelItems)

          if (modelItems.$require) items.require = modelItems.$require
          if (modelItems.$unique) items.unique = modelItems.$unique
          if (modelItems.$default) items.default = modelItems.$default
          if (modelItems.$limit) items.limit = modelItems.$limit

          if (modelItems.$size) {
            items.size = modelItems.$size
          }

          if (items.type === 'object') {
            items.model = that.convertModel(modelItems)
          }
        }

        newModel[key] = items
      })

    return newModel
  }

  getWrapper (name) {
    const schema = this.getSchema(name)
    const options = schema ? schema.options : {}

    return options.wrapper ? options.wrapper : null
  }

  validateSchema (name, entity) {
    const caller = this

    const schema = caller.getSchema(name)
    const model = caller.getModel(name)
    const options = schema.options || {}
    const methodKeys = Object.keys(options.methods || {})
    const validation = options.validation || {}

    if (validation) {
      if (typeof validations === 'function') {
        // defined function of validations, call it and ignore auto-validate
        validation(entity)

        return
      }
    }

    // check entity by other rules
    caller.validateEntity(
      entity,
      model,
      {
        strictMode: true,
        ignoreCaller: (key) => {
          if (methodKeys.includes(key)) return true

          return false
        }
      }
    )
  }

  validateEntity (entity, model, options) {
    // parse options
    const caller = options && options.caller ? options.caller : this
    const base = options && options.base ? options.base : ''
    // The flag of key in entity must defined in model
    const strictMode =
      options && options.strictMode ? options.strictMode : false
    // The function that check key need verify or not
    const ignoreCaller =
      options && options.ignoreCaller ? options.ignoreCaller : (key) => false

    // get the array of keys that defined in model
    const modelKeys = Object.keys(model)
    // get the array of keys that defined in entity
    const entityKeys = Object.keys(entity)

    const newOptions = {}

    Object.assign(newOptions, options)
    newOptions.caller = caller
    newOptions.base = base
    // newOptions.strictMode = strictMode

    // check for required fields
    modelKeys.
      filter((key) => model[key] && model[key].require).
      forEach((key) => {
        if (!(entityKeys.includes(key) || entity[key])) {
          throw ValidatorError.create(key, 'current key is required')
        }
      })

    // fetch every key defined in entity
    entityKeys.forEach((key) => {
      // ignore some key defined by system
      if (ignoreCaller && typeof ignoreCaller === 'function') {
        if (ignoreCaller(key)) return
      }

      const baseKey = base === '' ? key : `${base}.${key}`

      // check keys
      if (!modelKeys.includes(key)) {
        if (!strictMode) return

        throw ValidatorError.create(
          baseKey, 'Can\'t find the key defined in model')
      }

      const val = entity[key]
      const modelItems = model[key]

      if (!(val && modelItems.type)) return

      // check limitted value for current element
      if (modelItems.limit) {
        let matched = false

        if (Array.isArray(modelItems.limit)) {
          modelItems.
            limit.
            forEach((limit) => {
              if (matched) return

              matched = caller.matchLimit(val, limit)
            })
        } else {
          matched = caller.matchLimit(val, modelItems.limit)
        }

        if (!matched) {
          throw ValidatorError.create(
            baseKey, 'The value doesn\'t in limit')
        }
      }

      // get value type of every element
      const type = modelItems.type.toLowerCase()

      // check size
      if (modelItems.size) {
        switch (type) {
        case 'string':
          if (val.length > modelItems.size) {
            throw ValidatorError.create(
              baseKey, 'The length of value is greater than defined size')
          }
          break
        default:
          break
        }
      }

      // check type for every element
      if (modelItems.isArray) {
        if (!Array.isArray(val)) {
          throw ValidatorError.create(baseKey, 'Invalid array type')
        }

        val.forEach((item) => {
          if (type === 'object') {
            caller.validateEntity(item, model[key].model, newOptions)
          } else {
            caller.validateType(key, item, type, newOptions)
          }
        })
      } else if (type === 'object') {
        newOptions.base = key
        caller.validateEntity(entity[key], model[key].model, newOptions)
      } else {
        caller.validateType(key, val, type, newOptions)
      }
    })
  }

  validateType (key, val, type, options) {
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
    case 'datetime':
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
    case 'boolean':
    case 'blob':
    case 'buffer':
      break
    default:
      throw ValidatorError.create(
        baseKey, `doesn't support current type: ${type}`)
    }
  }

  matchLimit (val, limit) {
    switch (typeof limit) {
    case 'string':
      if (val === limit) return true

      return false
    case 'function':
      return limit(val)
    case 'object':
      if (limit instanceof RegExp) {
        return limit.test(val.toString())
      }

      return false
    default:
      return false
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

    Object.
      keys(model).
      forEach((key) => {
        const modelItem = model[key]

        // ignore if current element has value
        if (entity[key]) {
          if (modelItem.type === 'object') {
            // ignore
            ctx.setDefaultValues(entity[key], modelItem)
          }

          return
        }

        // get default definition from model
        const defaultDefined =
          modelItem && modelItem.default ? modelItem.default : null

        // set default value
        if (defaultDefined) {
          entity[key] =
            typeof defaultDefined === 'function'
             ? Reflect.apply(defaultDefined, entity, [])
             : defaultDefined
        }

        // check chlid elements
        if (modelItem.isArray) {
          entity[key] = []
        } else if (modelItem.type === 'object') {
          entity[key] = {}

          ctx.setDefaultValues(entity[key], modelItem.model)

          // remove current key form entity if there is no default value
          if (Object.keys(entity[key]).length === 0) {
            Reflect.deleteProperty(entity, key)
          }
        }
      })
  }

}

getRegex = function (macro) {
  return Schemas.getMacro(macro)
}

module.exports = Schemas
