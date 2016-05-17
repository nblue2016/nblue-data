
const path = require('path')
const data = require('../lib')

// const Cache = data.SchemaCache

const cache = data.SchemaCache.create()

// console.log(cache)

let file = undefined

file = path.join(__dirname, './schemas/blog.json')
cache.add(file)

file = path.join(__dirname, './schemas/blog._js')
cache.add(file)

const schemas = cache.getSchemas('mongo')
if (schemas.has('post')) {
  console.log(schemas.get('post'))
}
// console.log(Object.keys(schemas.toObject()))
// console.log(schemas.values())
