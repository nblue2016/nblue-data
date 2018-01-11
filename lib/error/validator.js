class ValidatorError extends Error {

  constructor () {
    super()

    this._properties = new Map()
  }

  static create (key, message) {
    const err = new ValidatorError()

    err.Properties.set(key, message)
    err.message = err.toString()

    return err
  }

  get Properties () {
    return this._properties
  }

  toString () {
    let message = ''

    for (const [key, val] of this.Properties) {
      if (message.length > 0) message += '\r\n'
      message += `validate failed for ${key}, message:${val}`
    }

    return message
  }

}

module.exports = ValidatorError
