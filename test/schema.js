const assert = require('assert')
const path = require('path')

const ndata = require('../lib')
const Schemas = ndata.Schemas

describe('schemas - parse file', () => {
  let ss = null

  before((done) => {
    Promise.all([
      Schemas.parse(path.join(__dirname, 'schemas', 'blog.json')),
      Schemas.parse(path.join(__dirname, 'schemas', 'blog.js')),
      Schemas.parse(path.join(__dirname, 'schemas', 'blog.sjs'))
    ]).
    then((data) => {
      ss = data

      done()
    }).
    catch((err) => done(err))
  })

  it('Tested parsed JSON file', () => {
    const keys = ss[0].Keys
    const entityKeys = ['post', 'user', 'team']

    assert.equal(keys.length, entityKeys.length, 'length of objects')
    assert.deepEqual(keys, entityKeys, 'values in objects')

    const post = ss[0].getSchema('post')
    const postModel = Schemas.getModel(post)
    const postKeys = Object.keys(postModel)
    const expextedKeys = [
      'title',
      'abstract',
      'content',
      'tags',
      'publishedOn',
      'publishedBy',
      'status',
      'viewCount',
      'likeCount',
      'CanComment'
    ]

    assert.equal(postKeys.length, expextedKeys.length, 'length of post')
    assert.deepEqual(postKeys, expextedKeys, 'values in post')
  })

  it('Tested parsed JS file', () => {
    const keys = ss[1].Keys
    const entityKeys = ['post']

    assert.equal(keys.length, entityKeys.length, 'length of objects')
    assert.deepEqual(keys, entityKeys, 'values in objects')

    const post = ss[1].getSchema('post')
    const postModel = Schemas.getModel(post)
    const postKeys = Object.keys(postModel)
    const expextedKeys = [
      'title',
      'key',
      'complexKey',
      'complexKey2',
      'size',
      'abstract',
      'data',
      'content',
      'tags',
      'publishedOn',
      'publishedBy',
      'email',
      'status',
      'viewCount',
      'likeCount',
      'CanComment'
    ]

    assert.equal(postKeys.length, expextedKeys.length, 'length of post')
    assert.deepEqual(postKeys, expextedKeys, 'values in post')

    // assert field isArray
    assert.ok(!postModel.title.isArray, 'array of title')
    assert.ok(!postModel.key.isArray, 'array of key')
    assert.ok(!postModel.complexKey.isArray, 'array of complexKey')
    assert.ok(!postModel.complexKey2.isArray, 'array of complexKey2')

    assert.ok(!postModel.size.isArray, 'array of size')
    assert.ok(!postModel.abstract.isArray, 'array of abstract')
    assert.ok(!postModel.data.isArray, 'array of data')
    assert.ok(!postModel.content.isArray, 'array of content')

    assert.ok(postModel.tags.isArray, 'array of tags')
    assert.ok(!postModel.publishedOn.isArray, 'array of publishedOn')
    assert.ok(!postModel.publishedBy.isArray, 'array of publishedBy')
    assert.ok(!postModel.email.isArray, 'array of email')

    assert.ok(!postModel.status.isArray, 'array of status')
    assert.ok(!postModel.viewCount.isArray, 'array of viewCount')
    assert.ok(!postModel.likeCount.isArray, 'array of likeCount')
    assert.ok(!postModel.CanComment.isArray, 'array of CanComment')


    // assert field type
    assert.equal(postModel.title.type, 'string', 'type of title')
    assert.equal(postModel.key.type, 'string', 'type of key')
    assert.equal(postModel.complexKey.type, 'object', 'type of complexKey')
    assert.equal(postModel.complexKey2.type, 'string', 'type of complexKey2')

    assert.equal(postModel.size.type, 'number', 'type of size')
    assert.equal(postModel.abstract.type, 'string', 'type of abstract')
    assert.equal(postModel.data.type, 'buffer', 'type of data')
    assert.equal(postModel.content.type, 'string', 'type of content')

    assert.equal(postModel.tags.type, 'string', 'type of tags')
    assert.equal(postModel.publishedOn.type, 'date', 'type of publishedOn')
    assert.equal(postModel.publishedBy.type, 'string', 'type of publishedBy')
    assert.equal(postModel.email.type, 'string', 'type of email')

    assert.equal(postModel.status.type, 'number', 'type of status')
    assert.equal(postModel.viewCount.type, 'number', 'type of viewCount')
    assert.equal(postModel.likeCount.type, 'number', 'type of likeCount')
    assert.equal(postModel.CanComment.type, 'boolean', 'type of CanComment')


    // assert field require
    assert.ok(postModel.title.require, 'require of title')
    assert.ok(!postModel.key.require, 'require of key')
    assert.ok(!postModel.complexKey.require, 'require of complexKey')
    assert.ok(!postModel.complexKey2.require, 'require of complexKey2')

    assert.ok(!postModel.size.require, 'require of size')
    assert.ok(!postModel.abstract.require, 'require of abstract')
    assert.ok(!postModel.data.require, 'require of data')
    assert.ok(!postModel.content.require, 'require of content')

    assert.ok(!postModel.tags.require, 'require of tags')
    assert.ok(!postModel.publishedOn.require, 'require of publishedOn')
    assert.ok(!postModel.publishedBy.require, 'require of publishedBy')
    assert.ok(!postModel.email.require, 'require of email')

    assert.ok(!postModel.status.require, 'require of status')
    assert.ok(!postModel.viewCount.require, 'require of viewCount')
    assert.ok(!postModel.likeCount.require, 'require of likeCount')
    assert.ok(!postModel.CanComment.require, 'require of CanComment')

    // assert field size
    assert.equal(postModel.title.size, 60, 'size of title')
    assert.ok(!postModel.key.size, 'size of key')

    // assert field default
    assert.ok(!postModel.title.default, 'default of title')
    assert.equal(postModel.complexKey2.default, 'a', 'default of complexKey2')

    const childSchema = postModel.complexKey
    const childModel = childSchema.model
    const childKeys = Object.keys(childModel)
    const expextedChildKeys = ['key1', 'key2']

    // assert summary of child object
    assert.equal(
      childKeys.length,
      expextedChildKeys.length,
      'length of childKeys'
    )
    assert.deepEqual(childKeys, expextedChildKeys, 'values in childKeys')

    // assert child field isArray
    assert.ok(!childModel.key1.isArray, 'array of child key1')
    assert.ok(!childModel.key2.isArray, 'array of child key2')

    // assert child field type
    assert.equal(childModel.key1.type, 'string', 'type of child key1')
    assert.equal(childModel.key2.type, 'string', 'type of child key2')

    // assert child field require
    assert.ok(!childModel.key1.require, 'require of child key1')
    assert.ok(!childModel.key2.require, 'require of child key2')

    // assert child field default
    assert.ok(!childModel.key1.default, 'default of child key1')
    assert.equal(childModel.key2.default, 'key22', 'default of child key2')

    // assert child field size
    assert.ok(!childModel.key1.size, 'require of child size')
    assert.equal(childModel.key2.size, 30, 'require of child size')
  })

  it('Tested parsed SJS file', () => {
    const keys = ss[2].Keys
    const entityKeys = ['post']

    assert.equal(keys.length, entityKeys.length, 'length of objects')
    assert.deepEqual(keys, entityKeys, 'values in objects')

    const post = ss[2].getSchema('post')
    const postModel = Schemas.getModel(post)
    const postKeys = Object.keys(postModel)
    const expextedKeys = [
      'title',
      'key',
      'complexKey',
      'complexKey2',
      'size',
      'abstract',
      'data',
      'content',
      'tags',
      'publishedOn',
      'publishedBy',
      'email',
      'status',
      'viewCount',
      'likeCount',
      'CanComment'
    ]

    assert.equal(postKeys.length, expextedKeys.length, 'length of post')
    assert.deepEqual(postKeys, expextedKeys, 'values in post'
    )
  })
})

describe('schemas - parse files', () => {
  let ss = null

  before((done) => {
    const files = ['blog.json', 'blog.js', 'northwind.json'].
      map(
        (file) => path.join(__dirname, 'schemas', file)
      )

    Schemas.
      parse(files).
      then((data) => {
        ss = data
        done()
      }).
      catch((err) => done(err))
  })

  it('Test all entities in schemas', () => {
    const keys = ss.Keys
    const entityKeys = ['post', 'user', 'team', 'category', 'customer']

    assert.equal(keys.length, entityKeys.length, 'length of objects')
    assert.deepEqual(keys, entityKeys, 'values in objects')
  })

  it('Test post entity in schemas', () => {
    const post = ss.getSchema('post')
    const postModel = Schemas.getModel(post)
    const postKeys = Object.keys(postModel)
    const expextedKeys = [
      'title',
      'key',
      'complexKey',
      'complexKey2',
      'size',
      'abstract',
      'data',
      'content',
      'tags',
      'publishedOn',
      'publishedBy',
      'email',
      'status',
      'viewCount',
      'likeCount',
      'CanComment'
    ]

    assert.equal(post.database, 'conn1', 'database name of post')
    assert.equal(post.options.collection, 'post', 'collection name of post')
    assert.equal(post.options.table, 'post', 'table name of post')
    assert.equal(postKeys.length, expextedKeys.length, 'length of post')
    assert.deepEqual(postKeys, expextedKeys, 'values in post')
  })

  it('Test user entity in schemas', () => {
    const user = ss.getSchema('user')
    const userModel = Schemas.getModel(user)
    const userKeys = Object.keys(userModel)
    const expextedKeys = [
      'userToken',
      'nick',
      'email',
      'avatarFileToken',
      'phone',
      'description',
      'homepage',
      'gender',
      'birthday',
      'createdOn',
      'updatedOn'
    ]

    assert.equal(user.database, 'conn1', 'database name of user')
    assert.equal(user.options.collection, 'user2', 'collection name of user')
    assert.equal(user.options.table, 'user2', 'table name of user')
    assert.equal(userKeys.length, expextedKeys.length, 'length of user')
    assert.deepEqual(userKeys, expextedKeys, 'values in user')
  })

  it('Test team entity in schemas', () => {
    const team = ss.getSchema('team')
    const teamModel = Schemas.getModel(team)
    const teamKeys = Object.keys(teamModel)
    const expextedKeys = [
      'nick',
      'email',
      'avatarFileToken',
      'phone',
      'description',
      'homepage',
      'users'
    ]

    assert.equal(team.database, 'conn3', 'database name of team')
    assert.equal(team.options.collection, 'team', 'collection name of team')
    assert.equal(team.options.table, 'team2', 'table name of team')
    assert.equal(teamKeys.length, expextedKeys.length, 'length of team')
    assert.deepEqual(teamKeys, expextedKeys, 'values in team')
  })

  it('Test category entity in schemas', () => {
    const category = ss.getSchema('category')
    const categoryModel = Schemas.getModel(category)
    const categoryKeys = Object.keys(categoryModel)
    const expextedKeys = [
      'CategoryID',
      'Description',
      'CategoryName'
    ]

    assert.equal(category.database, 'conn2', 'database name of category')
    assert.equal(
      category.options.collection,
      'categories',
      'collection name of category'
    )
    assert.equal(category.options.table, 'categories', 'table name of category')
    assert.equal(categoryKeys.length, expextedKeys.length, 'length of category')
    assert.deepEqual(categoryKeys, expextedKeys, 'values in category')
  })

  it('Test customer entity in schemas', () => {
    const customer = ss.getSchema('customer')
    const customerModel = Schemas.getModel(customer)
    const customerKeys = Object.keys(customerModel)
    const expextedKeys = [
      'City',
      'Fax',
      'PostalCode',
      'ContactTitle',
      'Phone',
      'ContactName',
      'CustomerID',
      'Country',
      'CompanyName',
      'Region',
      'Address'
    ]

    assert.equal(customer.database, 'conn2', 'database name of customer')
    assert.equal(
      customer.options.collection,
      'Customers',
      'collection name of customer'
    )
    assert.equal(customer.options.table, 'Customers', 'table name of customer')
    assert.equal(customerKeys.length, expextedKeys.length, 'length of customer')
    assert.deepEqual(customerKeys, expextedKeys, 'values in customer')
  })
})
