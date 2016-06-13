require('nblue-core')

// const path = require('path')
const dataLib = require('../lib')

// const Mongoose = require('mongoose')
const ConfigMap = global.ConfigMap
const Proxy = dataLib.MongoDbProxy
// const Proxy = dataLib.MongooseProxy
const DbConnections = dataLib.DbConnections

// parse configuration file
const configFile = String.format('%s/config.yml', __dirname)
const config = ConfigMap.
  parseConfigSync(configFile, ['dev', 'debug', 'qa'])

if (!global.config) global.config = config

const conns = new DbConnections()

conns.registerProxy('mongodb:', new Proxy())

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
