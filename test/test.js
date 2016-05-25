const assert = require('assert')
const fs = require('fs')
const path = require('path')

const dataLib = require('../lib')

const config = global.config
const MongoDbConnections = dataLib.MongoDbConnections
const MongoDbAdapter = dataLib.MongoDbAdapter

const conns = new MongoDbConnections()
const files = ['/schemas/blog.json', '/schemas/northwind.json']

files.
  map((file) => path.join(__dirname, file)).
  map((file) => JSON.parse(fs.readFileSync(file))).
  forEach((schema) => conns.appendSchema(schema))

conns.createByConfig('conn1', config)

conns.on('open', () => {
  const dbAdapter = new MongoDbAdapter(conns)

  dbAdapter.create(
    'post',
    { title: 'good news' },
    (err, data) => {
      console.log(err)
      if (err) console.log(err.message)
      assert('1', 1, data)
      console.log(data)
    }
  )
})
