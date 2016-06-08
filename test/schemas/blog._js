{
  database: {
    default: 'conn1'
  },
  entity: {
    post: {
      model: {
        title: 'String',
        complexTitle:{
          titile: 'String',
          key: {
            type:'String',
            default: 'test'
          }
        },
        key: {
          type: 'String',
          require: true,
          default: 'key1',
          limit: ['key1', 'key2']
        },
        abstract: 'String',
        content: 'String',
        tags: ['String'],
        publishedOn: {
          type: 'Date',
          default: function(){
            return new Date()
          }
        },
        publishedBy: 'String',
        status: 'Number',
        viewCount: 'Number',
        likeCount: 'Number',
        CanComment: 'Boolean'
      },
      options: {
        collection: 'post',
        wrapper:{
          'to': (post) => {
            post.tags = ['test']

            return post
          },
          'from': (post) => {
            post.tags = ['wrapped']

            return post
          }
        },
        methods:{
          getNewTitle: function(){
            return `${this.title}_test`
          }
        },
        validate: function(post) {
          this.autoValidate(post)

          if (!post.title) throw new Error('invaild title')
        }
      }
    }
  }
}
