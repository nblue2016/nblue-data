const assert = require('assert')
const fs = require('fs')
const path = require('path')
const dataLib = require('../lib')
const ValidatorError = require('../lib/error/validator')

const aq = global.aq
const config = global.config
const DbConnections = dataLib.DbConnections

const timeOutValue = 5000

const proxies = [dataLib.MongoDbProxy, dataLib.MongooseProxy]
const createConnFunc = (proxy) => {
  const Proxy = proxy
  const conns = new DbConnections()

  conns.registerProxy('mongodb:', new Proxy())

  return conns
}

const envMap = new Map()

before(function (done) {
  const ctx = this

  ctx.timeout(20000)

  aq.parallel(
      proxies.map((proxy) => {
        const newConns = createConnFunc(proxy)

        return newConns.createByConfigs(config).
          then(() => {
            const Proxy = proxy
            const name = Proxy.name
            const envs = {}

            envs.conns = newConns
            envs.categoryAdapter = newConns.createAdapter('category')
            envs.postAdapter = newConns.createAdapter('post')
            envs.userAdapter = newConns.createAdapter('user')

            envMap.set(name, envs)

            return newConns
          })
      })
    ).
    then(() => done()).
    catch((err) => done(err))
})

describe('adapter test', () => {
  it('test', () => {
    const keys = 'test'

    assert.equal(keys, 'test', 'failed.')
  })
})

describe('create proxies', () => {
  proxies.
    forEach((proxy) => {
      const name = proxy.name

      describe(`post adapter with ${name}`, () => {
        let
          insertedPosts = [],
          postAdapter = null

        before((done) => {
          insertedPosts = []

          const envs = envMap.get(name)

          insertedPosts = []

          postAdapter = envs.postAdapter

          // clear old data
          postAdapter.
                  delete({}).
                  then(() => done()).
                  catch((err) => done(err))
        })

        it('create entity with callback', function (done) {
          this.timeout(timeOutValue)

          postAdapter.create(
                        { title: 'a good news' },
                        (err, data) => {
                          if (err) done(err)

                          assert.equal(
                            data.title, 'a good news', 'same value of title')

                          assert.deepEqual(
                              data.tags, ['wrapped'], 'same value of title')

                          insertedPosts.push(data._id)

                          done()
                        })
        })

        it('create entity with promise', function (done) {
          this.timeout(timeOutValue)

          postAdapter.
                    create({ title: 'good news' }).
                    then((data) => {
                      assert.equal(
                        data.title, 'good news', 'same value of title')

                      insertedPosts.push(data._id)

                      done()
                    }).
                    catch((err) => done(err))
        })

        it('retrieve and update entity with promise', function (done) {
          this.timeout(timeOutValue * 3)

          postAdapter.
                    retrieve({ _id: insertedPosts[0] }).
                    then((data) => {
                      const post = Array.isArray(data) ? data[0] : data

                      assert.equal(
                        post.title, 'a good news', 'same value of title')

                      post.title = 'bad news'

                      return postAdapter.update(
                        { _id: insertedPosts[0] },
                        { title: 'bad news' }
                      )
                    }).
                    then((data) => {
                      if (data.ok && data.ok === 1) {
                        return postAdapter.
                          retrieve({ _id: insertedPosts[0] })
                      }

                      throw new Error('no one update')
                    }).
                    then((data) => {
                      const post = Array.isArray(data) ? data[0] : data

                      assert.equal(
                        post.title, 'bad news', 'same value of title')

                      done()
                    }).
                    catch((err) => done(err))
        })

        it('retrieve list with promise', function (done) {
          this.timeout(timeOutValue * 3)

          postAdapter.
                    retrieve({
                      _id: {
                        $in: [insertedPosts[0], insertedPosts[1]]
                      }
                    }).
                    then((data) => {
                      const posts = data

                      assert.equal(posts.length, 2, 'got 2 posts')
                      assert.equal(
                        posts[0]._id.toString(),
                        insertedPosts[0],
                        'compare the 1st id'
                      )
                      assert.equal(
                        posts[1]._id.toString(),
                        insertedPosts[1],
                        'compare the 1st id'
                      )

                      done()
                    }).
                    catch((err) => done(err))
        })

        it('count with promise', function (done) {
          this.timeout(timeOutValue * 3)

          postAdapter.
                    count({
                      _id: {
                        $in: [insertedPosts[0], insertedPosts[1]]
                      }
                    }).
                    then((data) => {
                      assert.equal(data, 2, 'got count of posts is 2')
                      done()
                    }).
                    catch((err) => done(err))
        })

        it('delete entity with promise', function (done) {
          this.timeout(timeOutValue)

          const deleteFunc = postAdapter.delete
          const deleteFuncs = insertedPosts.
                    map((id) => deleteFunc.bind(postAdapter, { _id: id }))

          aq.
                    parallel(deleteFuncs).
                    then((data) => {
                      if (!Array.isArray(data)) {
                        throw new Error('Unexcepted result')
                      }

                      const results =
                        data.
                          map((result) => result.ok).
                          filter((val) => val === 1)

                      assert.equal(
                        results.length, 2, 'tow entites were deleted')

                      done()
                    }).
                    catch((err) => done(err))
        })
      })

      describe(`catagory adapter with ${name}`, () => {
        let categoryAdapter = null

        before((done) => {
          const envs = envMap.get(name)

          categoryAdapter = envs.categoryAdapter

          // clear old data
          categoryAdapter.
                  delete({}).
                  then(() => done()).
                  catch((err) => done(err))
        })

        it('create catagory with auto increment', function (done) {
          this.timeout(timeOutValue)

          let latestID = -2

          categoryAdapter.retrieve(
              {}, {
                sort: {
                  CategoryID: -1
                },
                limit: 1
              }).
            then((data) => {
              let entity = null

              if (data) {
                entity = Array.isArray(data) ? data[0] : data
                if (entity) latestID = entity.CategoryID
              }

              return categoryAdapter.create({
                CategoryName: 'test1',
                Description: 'test catagory'
              })
            }).
            then((data) => {
              const categoryID = latestID + 2

              assert.equal(data.CategoryID, categoryID, 'auto increment id')

              return categoryAdapter.create({
                CategoryName: 'test2',
                Description: 'test catagory'
              })
            }).
            then((data) => {
              const categoryID = latestID + 4

              assert.equal(
                data.CategoryID, categoryID, 'auto increment id, too')

              done()
            }).
            catch((err) => done(err))
        })
      })

      describe(`user adapter with ${name}`, () => {
        this.timeout = timeOutValue

        let
          userAdapter = null,
          users = []

        before((done) => {
          const envs = envMap.get(name)

          userAdapter = envs.userAdapter

          fs.readFile(
                path.join(__dirname, 'users.json'),
                { encoding: 'utf-8' },
                (err, data) => {
                  if (err) {
                    done(err)

                    return
                  }

                  users = JSON.parse(data)
                  done()
                }
              )
        })

        it('batch create users', (done) => {
          userAdapter.
              delete({}).
              then((data) => userAdapter.create(users)).
              then((data) => {
                assert.equal(data.length, 12, 'created users.')

                // test count function
                return userAdapter.count()
              }).
              then((data) => {
                assert.equal(data, 12, 'count users.')

                done()
              }).
              catch((err) => done(err))
        })

        it('find one by filter for users', (done) => {
          userAdapter.
              retrieve(
                {}, {
                  method: 'findOne'
                }
              ).
              then((data) => {
                assert.equal(
                  Array.isArray(data), false, 'only found one element')
                assert.equal(data.nick, 'test01', 'only found one element')

                done()
              }).
              catch((err) => done(err))
        })

        it('complex filter for users', (done) => {
          userAdapter.SimpleData = true

          userAdapter.
              retrieve({}).
              then((data) => {
                assert.equal(data.length, 12, 'filter all users.')

                // test limit options feature
                return userAdapter.
                  retrieve({}, { limit: 8 })
              }).
              then((data) => {
                assert.equal(
                  data.length, 8, 'get all users but limit return limit 8.')

                // test top options feature
                return userAdapter.
                  retrieve({}, { top: 6 })
              }).
              then((data) => {
                assert.equal(
                  data.length, 6, 'get all users but limit return top 6.')

                // test filter feature
                return userAdapter.
                  retrieve({
                    gender: 1
                  })
              }).
              then((data) => {
                assert.equal(data.length, 9, 'get users that gender is 1.')

                // test filter feature 2
                return userAdapter.
                  retrieve({
                    gender: 2
                  })
              }).
              then((data) => {
                assert.equal(data.length, 3, 'get users that gender is 2.')

                // test filter feature 3
                return userAdapter.
                  retrieve({
                    nick: 'test08'
                  })
              }).
              then((data) => {
                assert.equal(
                  data[0].email,
                  'test08@abc.com',
                  'get users that nick is test08.'
                )

                // test sort and pager options feature
                return userAdapter.
                  retrieve(
                    {}, {
                      sort: {
                        nick: 1
                      },
                      pageSize: 3,
                      page: 2
                    })
              }).
              then((data) => {
                // get the data by pager
                assert.equal(data.length, 3, 'get the count of matched users.')
                assert.equal(
                  data[0].nick, 'test04', 'get the 1st user in page 2 ')
                assert.equal(
                  data[1].nick, 'test05', 'get the 2nd user in page 2 ')
                assert.equal(
                  data[2].nick, 'test06', 'get the 3rd user in page 2 ')

                // test sort and pager options feature 2
                return userAdapter.
                  retrieve(
                    {}, {
                      sort: {
                        nick: 1
                      },
                      pageSize: 5,
                      page: 3
                    })
              }).
              then((data) => {
                // get the data by pager
                assert.equal(data.length, 2, 'get the count of matched users.')
                assert.equal(
                  data[0].nick, 'test11', 'get the 1st user in page 2 ')
                assert.equal(
                  data[1].nick, 'test12', 'get the 2nd user in page 2 ')

                // test sort, pager and projection options feature
                return userAdapter.
                  retrieve(
                    {}, {
                      projection: {
                        _id: 0,
                        nick: 1,
                        email: 1
                      },
                      sort: {
                        nick: 1
                      },
                      pageSize: 5,
                      page: 3
                    })
              }).
              then((data) => {
                // get the data by pager
                assert.equal(data.length, 2, 'get the count of matched users.')
                assert.deepEqual(
                  Object.keys(data[0]).sort(),
                  ['email', 'nick'],
                  'get properties of the 1st user'
                )
                assert.deepEqual(
                  Object.keys(data[1]).sort(),
                  ['email', 'nick'],
                    'get properties of the 1st user'
                  )

                done()
              }).
              catch((err) => done(err)).
              finally(() => {
                userAdapter.SimpleData = false
              })
        })

        it('batch modified items for users', (done) => {
          userAdapter.update(
            {
              gender: 1
            }, {
              nick: 'modified'
            }
            ).
            then((data) => {
              assert.equal(data.ok, 1, 'parse ok value')
              assert.equal(data.nModified, 9, 'parse nModified value')
              assert.equal(data.n, 9, 'parse n value')

              return userAdapter.
                retrieve({
                  nick: 'modified'
                })
            }).
            then((data) => {
              assert.equal(data.length, 9, '9 users were updated.')

              done()
            }).
            catch((err) => done(err))
        })

        it('batch delete items for users', (done) => {
          userAdapter.
              delete({
                gender: 2
              }).
              then((data) => {
                assert.equal(data.ok, 1, 'parse ok value')
                assert.equal(data.n, 3, 'parse n value')
                done()
              }).
              catch((err) => done(err))
        })
      })

      describe('test default value', () => {
        let postAdapter = null

        before((done) => {
          const envs = envMap.get(name)

          postAdapter = envs.postAdapter

          // clear old data
          postAdapter.
                  delete({}).
                  then(() => done()).
                  catch((err) => done(err))
        })

        it('test default value and bind methods', function (done) {
          this.timeout(timeOutValue)

          const post = {
            title: 'title1'
          }

          postAdapter.
            create(post).
            then((data) => {
              assert.equal(
                data.key, 'key1', 'get default value for post.key')
              assert.equal(
                data.complexTitle.key,
                'test',
                'get default value for post.complexTitle.key'
              )
              assert.equal(
                data.getNewTitle(),
                `${post.title}_test`,
                'call getNewTitle method'
              )

              done()
            }).
            catch((err) => done(err))
        })

        it('test wrapper function', (done) => {
          // postAdapter.ValidateBeforeSave = true
          postAdapter.getWrapper = function () {
            return {
              name: 'post',
              to: (post) => {
                post.abstract = 'abstract-test'
                post.viewCount = 10

                return post
              },
              from: (post) => post
            }
          }

          postAdapter.create({
            title: 'test'
          }).then((data) => {
            assert.equal(data.abstract, 'abstract-test', 'tested wrapper ')
            assert.equal(data.viewCount, 10, 'tested wrapper ')
            done()
          }).
          catch((err) => done(err))
        })

        after(() => {
          postAdapter.getWrapper = null
        })
      })

      describe('test validation for entity', () => {
        const validatorError = new Error('type error')

        let postAdapter = null

        before((done) => {
          const envs = envMap.get(name)

          postAdapter = envs.postAdapter
          postAdapter.ValidateBeforeSave = true

          // clear old data
          postAdapter.
                  delete({}).
                  then(() => done()).
                  catch((err) => done(err))
        })

        it('test invalid model key function', (done) => {
          postAdapter.create({
            title: 'test',
            name: 'invalid'
          }).then(() => {
            done(validatorError)
          }).
          catch((err) => {
            if (err instanceof ValidatorError) {
              done()

              return
            }

            done(err)
          })
        })

        it('test require key', (done) => {
          postAdapter.create({
            viewCount: 20,
            likeCount: 20
          }).then(() => {
            done(validatorError)
          }).
          catch((err) => {
            if (err instanceof ValidatorError) {
              done()

              return
            }

            done(err)
          })
        })

        it('test invalid string type', (done) => {
          postAdapter.create({
            title: 3232,
            status: 'unknown'
          }).then((data) => {
            done(validatorError)
          }).
          catch((err) => {
            if (err instanceof ValidatorError) {
              return postAdapter.create({
                title: 'test'
              })
            }

            return done(err)
          }).
          then(() => done()).
          catch((err) => done(err))
        })

        it('test invalid number type', (done) => {
          postAdapter.create({
            title: 'test',
            status: 'unknown'
          }).then((data) => {
            done(validatorError)
          }).
          catch((err) => {
            if (err instanceof ValidatorError) {
              return postAdapter.create({
                title: 'test',
                status: 2
              })
            }

            return done(err)
          }).
          then(() => done()).
          catch((err) => done(err))
        })

        it('test invalid date type', (done) => {
          postAdapter.create({
            title: 'test',
            publishedOn: 'unknown'
          }).then((data) => {
            done(validatorError)
          }).
          catch((err) => {
            if (err instanceof ValidatorError) {
              return postAdapter.create({
                title: 'test',
                publishedOn: new Date()
              })
            }

            return done(err)
          }).
          then(() => done()).
          catch((err) => done(err))
        })

        after(() => {
          // postAdapter.ValidateBeforeSave = false
          postAdapter = null
        })
      })
    })
})

after((done) => {
  const keys = Array.from(envMap.keys())

  aq.parallel(
    keys.map(
      (name) => {
        const envs = envMap.get(name)
        const conns = envs.conns

        return conns.closeAll()
      }
    )
  ).
  then(() => done()).
  catch((err) => done(err))
})
