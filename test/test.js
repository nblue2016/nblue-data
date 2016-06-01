require('nblue-core')

// const path = require('path')
const dataLib = require('../lib')

// const Mongoose = require('mongoose')
const ConfigMap = global.ConfigMap
// const Proxy = dataLib.MongoDbProxy
const Proxy = dataLib.MongooseProxy
// const DbConnections = dataLib.MongoDbConnections

// parse configuration file
const configFile = String.format('%s/config.yml', __dirname)
const config = ConfigMap.
  parseConfigSync(configFile, ['dev', 'debug', 'qa'])

if (!global.config) global.config = config

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

/*


const conns = new DbConnections()

// conns.Driver = 'mongodb'

conns.on('connected', (conn) => {
  console.log('# ready to close')

  global.setTimeout(() => {
    console.log('c1')
    // console.log(conns)

    conns.
      close(conn.Name).
      then((data) => {
        console.log('c2')
        // console.log(conns)

        console.log('# closed')
        console.log(data)
      })
  }, 100)
})

conns.
  createByConfig('conn1', config).
  then((data) => {
    console.log('# created')
    console.log(data.Name)
  }).
  catch((err) => {
    console.log('#error')
    console.log(err.message)
  })
*/
