const fs = require('fs')
const path = require('path')

const defaultType = 'mongo'
const schemeKeyDatabase = 'database'

let staticInstance = null

class SchemaCache
{

  constructor () {
    this._schemas = new Map()
  }

  get Schemas () {
    return this._schemas
  }

  static create () {
    if (staticInstance === null) {
      staticInstance = new SchemaCache()
    }

    return staticInstance
  }

  add (file, type) {
    const info = path.parse(file)

    if (info.ext === '.js' || info.ext === '._js') this.addJS(file, type)
    else if (info.ext === '.json') this.addJSON(file, type)
    else {
      throw new Error(`not support the extend name: ${info ? info.ext : ''}`)
    }
  }

  addJS (file, type) {
    // bind func for read schema file
    const readFile = fs.readFileSync.bind(this, file, { encoding: 'utf-8' })

    // read definition from file
    const content =
      `(function() {\r\n return ${readFile()} \r\n})()`

    this.createSchemas(global.eval(content), type)
  }

  addJSON (file, type) {
    this.createSchemas(
      JSON.parse(fs.readFileSync(file, { encoding: 'utf-8' })), type)
  }

  createSchemas (schemas, type) {
    // assign target to ctx
    const ctx = this

    // get variants from schemas
    let newType = type

    if (!newType) newType = schemas.type ? schemas.type : defaultType

    const database = schemas.database ? schemas.database : {}
    const entity = schemas.entity ? schemas.entity : {}

    const createSchema = (name, schema) => {
      const defaultDatabase = database.default ? database.default : 'default'
      const item = {}

      item.name = name

      const options = schema.options ? schema.options : {}

      item.database = schema[schemeKeyDatabase]
                        ? schema[schemeKeyDatabase]
                        : defaultDatabase
      item.model = schema.model ? schema.model : {}
      item.options = options

      switch (newType) {
      case 'mongo':
        item.collection = options.collection ? options.collection : name
        break
      default:
        break
      }

      return item
    }

    // get schemas for current type
    const fnCache = () => {
      if (!ctx.Schemas.has(newType)) {
        ctx.Schemas.set(newType, new Map())
      }

      return ctx.Schemas.get(newType)
    }

    const cache = fnCache()

    // fetch every entity in schemas
    Object.
      keys(entity).
      forEach((name) => {
        const single = createSchema(name, entity[name])

        // create schema for every entity by name
        cache.set(name, single)
      })
  }

  getSchemas (type) {
    return this.Schemas.has(type) ? this.Schemas.get(type) : new Map()
  }

}

module.exports = SchemaCache
