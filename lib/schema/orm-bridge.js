class OrmBridge
{

  static toORMModel (schema) {
    const result = {}

    const scModel = {}
    const options = {}

    Object.
      keys(schema.model).
      forEach((key) => {
        const item = schema.model[key]

        if (item.isArray) scModel[key] = Object
        else if (OrmBridge.hasOrmEnum(item.limit)) {
          scModel[key] = OrmBridge.getEnum(item.limit)
        } else {
          switch (item.type) {
          case 'number':
          case 'integer':
          case 'float':
            scModel[key] = Number
            break
          case 'boolean':
            scModel[key] = Boolean
            break
          case 'date':
            scModel[key] = Date
            break
          case 'object':
            scModel[key] = Object
            break
          case 'blob':
          case 'buffer':
            scModel[key] = Buffer
            break
          default:
            scModel[key] = String
            break
          }
        }
      })

    result.name = schema.name
    result.model = scModel
    result.options = OrmBridge.parseOptions(schema)

    return result
  }

  static toORMFullModel (schema) {
    const result = {}

    const scModel = {}
    const options = {}

    Object.
      keys(schema.model).
      forEach((key) => {
        const item = schema.model[key]

        scModel[key] = {}

        if (item.isArray) scModel[key].type = 'object'
        else if (OrmBridge.hasOrmEnum(item.limit)) {
          scModel[key].type = 'enum'
          scModel[key].values = OrmBridge.getEnum(item.limit)
        } else {
          scModel[key].type = OrmBridge.getOrmType(item.type)
          if (item.type === 'date') scModel[key].time = false
          else if (item.type === 'datetime') scModel[key].time = true
        }

        if (item.require) scModel[key].require = item.require
        if (item.unique) scModel[key].unique = item.unique
        if (item.default) {
          // doesn't support, ignore default function
          // scModel[key].defaultValue = item.default()
          if (typeof item.default !== 'function') {
            scModel[key].defaultValue = item.default
          }
        }
        if (item.size) scModel[key].size = item.size
      })

    result.name = schema.name
    result.model = scModel
    result.options = OrmBridge.parseOptions(schema)

    return result
  }

  static hasOrmEnum (limit) {
    if (!limit) return false

    return OrmBridge.getEnum(limit).length > 0
  }

  static getEnum (limit) {
    const allowValue = (val) => {
      if (typeof val === 'string') {
        if (val.startsWith('@') ||
          val.startsWith('$')) return false

        return true
      }

      return false
    }

    return Array.isArray(limit)
      ? limit.filter((item) => allowValue(item))
      : allowValue(limit)
  }

  static getOrmType (type) {
    switch (type) {
    case 'string':
      return 'text'
    case 'float':
      return 'number'
    case 'object':
      return 'object'
    case 'blob':
    case 'buffer':
      return 'binary'
    default:
      return type
    }
  }

  static parseOptions (schema) {
    const options = schema.options
    const newOptions = {}

    if (options.methods) newOptions.methods = options.methods
    if (options.hooks) newOptions.hooks = options.hooks

    return newOptions
  }

}

module.exports = OrmBridge
