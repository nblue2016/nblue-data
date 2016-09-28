class TypeError extends Error
{

  constructor (type, message) {
    super()

    this._type = type
    this.message = message
  }

}

module.exports = TypeError
