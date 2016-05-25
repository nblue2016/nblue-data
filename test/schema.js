const assert = require('assert')

const schemas = global.schemas


describe('schemas', () => {
  it('Loadded objects', () => {
    const keys = Object.keys(schemas.toObject())

    assert.equal(keys.length, 5, 'then length of loaded objects.')
    assert.deepEqual(keys,
      ['post', 'user', 'team', 'category', 'customer'],
      'loadded 5 objects')
  })

  it('Post object', () => {
    assert.equal(schemas.has('post'), true, 'loadded post.')

    const post = schemas.get('post')

    const database = post.database

    assert.equal(database, 'conn1', 'found property of database')

    const model = post.model
    const mapped = Object.toMap(model, true)

    assert.equal(mapped.has('title'), true, 'found property of title')
    assert.equal(mapped.has('abstract'), true, 'found property of abstract')
    assert.equal(mapped.has('content'), true, 'found property of content')
    assert.equal(mapped.has('tags'), true, 'found property of tags')
    assert.equal(
      mapped.has('publishedOn'), true, 'found property of publishedOn')

    assert.equal(
      mapped.has('publishedBy'), true, 'found property of publishedBy')
    assert.equal(mapped.has('status'), true, 'found property of status')
    assert.equal(mapped.has('viewCount'), true, 'found property of viewCount')
    assert.equal(mapped.has('likeCount'), true, 'found property of likeCount')
    assert.equal(
      mapped.has('CanComment'), true, 'found property of CanComment')

    assert.equal(model.title, 'String', 'type property of title')
    assert.equal(model.abstract, 'String', 'type property of abstract')
    assert.equal(model.content, 'String', 'type property of content')
    assert.deepEqual(model.tags, ['String'], 'type property of tags')
    assert.deepEqual(
      model.publishedOn.type, 'Date', 'found property of publishedOn')

    assert.equal(model.publishedBy, 'String', 'type property of publishedBy')
    assert.equal(model.status, 'Number', 'type property of status')
    assert.equal(model.viewCount, 'Number', 'type property of viewCount')
    assert.equal(model.likeCount, 'Number', 'type property of likeCount')
    assert.equal(model.CanComment, 'Boolean', 'type property of CanComment')
  })

  it('User object', () => {
    assert.equal(schemas.has('user'), true, 'loadded user.')

    const user = schemas.get('user')

    const database = user.database

    assert.equal(database, 'conn1', 'found property of database')

    const model = user.model
    const mapped = Object.toMap(model, true)

    assert.equal(mapped.has('userToken'), true, 'found property of userToken')
    assert.equal(mapped.has('title'), false, 'don\'t found property of title')
  })

  it('Team object', () => {
    assert.equal(schemas.has('team'), true, 'loadded team.')

    const team = schemas.get('team')

    const database = team.database

    assert.equal(database, 'conn1', 'found property of database')

    const model = team.model
    const mapped = Object.toMap(model, true)

    assert.equal(mapped.has('nick'), true, 'found property of userToken')
    assert.equal(mapped.has('title'), false, 'don\'t found property of title')
  })
})
