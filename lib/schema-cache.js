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

}

module.exports = SchemaCache
