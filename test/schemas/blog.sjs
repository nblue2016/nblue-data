schemas({
  $database: {
    default: 'conn1'
  },
  post: {
    model: {
      title: String,
      key: String,
      complexKey: {
        key1: String,
        key2: String
      },
      complexKey2: String,
      size: Number,
      abstract: 'String',
      data: Buffer,
      content: String,
      tags: [String],
      publishedOn: Buffer,
      publishedBy: String,
      email: String,
      status: Number,
      viewCount: Number,
      likeCount: Number,
      CanComment: Boolean
    },
    options: {
      collection: 'post',
      wrapper: {
        to: (item) => item,
        from: (item) => item
      },
      methods: {
        getNewTitle () {
          return `${this.title}_new`
        }
      },
      hook: {

      }
    }
  }
})
