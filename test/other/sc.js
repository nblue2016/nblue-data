require('nblue')

const path = require('path')
const lib = require('../lib')
const orm = require('orm')

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

    const nblueSchema = schemas.getSchema('post')
    const ormSchema = OrmBridge.toORMModel(nblueSchema)
    // const ormModel = ormSchema.model

    console.log(formatObjct(ormSchema))

    orm.connect(
      'sqlite://test/nblue.sqlite',
     (err, db) => {
       if (err) {
         console.log(`error occur when open database, details: ${err.message}`)

         return
       }

       const Post = db.define('post', ormSchema.model, ormSchema.options)

       db.sync((err2) => {
         if (err2) {
           console.log(`sync db failed, details: ${err2.message}`)

           return
         }

         if (Post) {
           Post.create({
             title: 'test1',
             key: 'key22',
             tags: ['t1', 't2', 't3']
           }, (err3, post) => {
             if (err3) {
               console.log(`create post failed, details: ${err2.message}`)

               return
             }

             console.log(post.title)
           })

           console.log('OK')
           db.close((err4) => {
             if (err4) {
               console.log(`close database failed, details: ${err4.message}`)

               return
             }

             console.log('closed db')
           })
         }
       })

       // console.log(Post)
     }
   )

/*
    console.log('output model for nblue')
    console.log(postSchema)

    console.log('output model for ORM full')
    console.log(OrmBridge.toORMFullModel(postSchema))

    console.log('output model for ORM simple')
    console.log(formatObjct(OrmBridge.toORMModel(postSchema)))
    */
    // console.log(JSON.stringify(postOrmModel, null, 4))
  }).
  catch((err) => {
    console.log('#err')
    console.log(err.message)
  })
