require('nblue')

// const path = require('path')
const dataLib = require('../lib')

// const Mongoose = require('mongoose')
const ConfigMap = global.ConfigMap
const Proxy = dataLib.MongoDbProxy
const OrmProxy = dataLib.OrmDbProxy
const DbConnections = dataLib.DbConnections

// parse configuration file
const configFile = String.format('%s/config2.yml', __dirname)
const config = ConfigMap.
  parseConfigSync(configFile, ['dev', 'debug', 'qa'])

if (!global.config) global.config = config

const conns = new DbConnections()

conns.registerProxy('mongodb:', new Proxy())
conns.registerProxy('sqlite:', new OrmProxy())
conns.registerProxy('mysql:', new OrmProxy())

conns.on('open', (name) => {
  console.log(`open ${name}`)
})

conns.on('connected', (name) => {
  console.log(`connected ${name}`)
})

conns.on('close', (name) => {
  console.log(`close ${name}`)
})

conns.on('disconnected', (name) => {
  console.log(`disconnected ${name}`)
})

conns.on('error', (err) => {
  console.log(`# event error, details: ${err.message}`)
})

conns.
  createByConfigs(config).
  then(() => {
    console.log('created all')

    const conn = conns.get('conn1')

    console.log(`get conn: ${conn.Name}`)

    const proxy = conn.Proxy
    const adapter = proxy.createAdapter('post', conn)

    console.log(adapter)


    return conns.closeAll()
  }).
  then(() => {
    console.log('closed all')
  }).
  catch((err) => {
    console.log('#error')
    console.log(err.message)

    conns.
      closeAll().
      then((data) => {
        console.log('# closed when issue occured.')
      })
  })
