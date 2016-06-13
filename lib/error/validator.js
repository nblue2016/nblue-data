class ValidatorError extends Error
{

  constructor (... args) {
    super(... args)

    this._message = ''
  }

  toString () {
  }

}

module.exports = ValidatorError
