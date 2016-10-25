const nblue = require('nblue')
const betch = nblue.betch
const ConfigMap = nblue.ConfigMap

const path = require('path')
const dataLib = require('../lib')
const Schemas = dataLib.Schemas

const files = ['blog.json', 'blog.js', 'northwind.json'].
  map(
    (file) => path.join(__dirname, 'schemas', file)
  )

const configFile = String.format('%s/config.yml', __dirname)

const ctx = {}

betch({
  cf: ConfigMap.parseConfigSync(
        configFile,
        ['dev', 'debug', 'qa']
      ),
  sc: Schemas.parse(files)
}, ctx).
then(
  () => {
    console.log('parsed config')
    console.log(JSON.stringify(ctx.cf.toObject(), null, 4))

    console.log('parsed schemas:')

    const output = (name) => {
      const $$ = ctx.sc.getSchema(name)

      console.log(`get model: ${name}`)
      console.log(Schemas.format($$))
      // console.log(JSON.stringify($$, null, 4))
    }

    // output('post')
    output('user')
  }
).
catch((err) => {
  console.log(err)
})
