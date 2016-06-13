const url = require('url')
const querystring = require('querystring')

class DbProxy
{

  parseUrl (dbUrl) {
    const cs = url.parse(dbUrl)
    const qy = querystring.parse(cs ? cs.query || {} : {})

    const result = {}

    result.protocol = cs.protocol

    result.user = null
    result.password = null

    // parse user and password
    if (cs.auth) {
      const index = cs.auth.indexOf(':')

      if (index >= 0) {
        result.user = cs.auth.substring(0, index)
        result.password = cs.auth.substring(index + 1, cs.auth.length)
      } else {
        result.user = cs.auth
      }
    }

    // parse host
    let startWord = '//'

    if (dbUrl.indexOf('@') >= 0) startWord = '@'

    const index = dbUrl.indexOf(startWord)
    const lastIndex = dbUrl.lastIndexOf('/')

    result.host = dbUrl.substring(index + startWord.length, lastIndex)

    // parse database
    const ss = cs.pathname.split('/')

    result.database = ss[ss.length - 1]

    // parse options
    result.options = {}

    Object.
      keys(qy).
      forEach((key) => {
        result.options[key] = qy[key]
      })

    return result
  }

  open () {
    throw new Error('doesn\'t support.')
  }

  close () {
    throw new Error('doesn\'t support.')
  }

  createAdapter () {
    throw new Error('doesn\'t support.')
  }

}

module.exports = DbProxy
