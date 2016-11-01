// define test script files
const testScripts = [
  './schema',
  '#./connections',
  '#./adapter/crud',
  '#./adapter/default',
  '#./adapter/validator'
]

describe('init envirnment', () => {
  it('exec scripts', () => {
    for (const script of testScripts) {
      if (script.startsWith('#')) continue

      require(script)
    }
  })
})
