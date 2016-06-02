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

/*
const url = config.get('connections')[0].get('conn1')

const proxy = new Proxy()
const result = proxy.parseUrl(url)

console.log(result)
proxy.
  open(result.connectionString, result.options).
  then((conn) => {
    console.log('opened')

    return proxy.close(conn)
  }).
  then(() => {
    console.log('closed')
  }).
  catch((err) => {
    console.log('#error')
    console.log(err.message)
  })
*/

const conns = new DbConnections()

conns.registerProxy('mongodb:', new Proxy())

/*
conns.
  createByConfig('conn1', config).
  then((data) => {
    console.log('# created')
    console.log(data.Name)

    conns.
      close('conn1').
      then((conn) => {
        console.log(conn.Name)

        return 0
      })
  }).
  catch((err) => {
    console.log('#error')
    console.log(err.message)
  })
*/

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
