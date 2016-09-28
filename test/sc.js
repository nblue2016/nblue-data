require('nblue')
const path = require('path')
const lib = require('../lib')

const Schemas = lib.Schemas
const OrmBridge = lib.OrmBridge

// parse schema files
const schemas = Schemas.create()

const formatObjct = (obj) => {
  const newObj = {}

  if (obj.model) {
    const newModel = {}

    Object.
      keys(obj.model).
      forEach((key) => {
        if (typeof obj.model[key] === 'function') {
          newModel[key] = obj.model[key].name
        } else {
          newModel[key] = obj.model[key]
        }
      })

    newObj.model = newModel
  }

  newObj.options = obj.options

  return newObj
}

schemas.
  readFile(path.join(__dirname, 'schemas', 'blog.js')).
  then((data) => {
    console.log('finished')

    const postSchema = schemas.getSchema('post')

    console.log('output model for nblue')
    console.log(postSchema)

    console.log('output model for ORM full')
    console.log(OrmBridge.toORMFullModel(postSchema))

    console.log('output model for ORM simple')
    console.log(formatObjct(OrmBridge.toORMModel(postSchema)))
    // console.log(JSON.stringify(postOrmModel, null, 4))
  }).
  catch((err) => {
    console.log('#err')
    console.log(err.message)
  })
