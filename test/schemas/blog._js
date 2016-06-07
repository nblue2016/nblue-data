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
          default: 'test-key'
        },
        abstract: 'String',
        content: 'String',
        tags: ['String'],
        publishedOn: {
          type: 'Date',
          default: () => new Date()
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
        }
      },
      methods:{
        getName: function(){
          return `${this.title}_test`
        }
      }
    }
  }
}
