schemas({
  $database: {
    default: 'conn1'
  },
  post: {
    model: {
      title: {
        $type: String,
        $size: 60,
        $require: true
      },
      key: {
        $type: String,
        $default: 'key1',
        $limit: ['key1', 'key2', predefine('aa'), 'key4']
      },
      complexKey: {
        key1: String,
        key2: {
          $size: 30,
          $default: 'ckey12'
        }
      },
      complexKey2: {
        $default: 'ckey2'
      },
      size: {
        $type: Number,
        $limit: range(1, 20000)
      },
      abstract: 'String',
      data: Buffer,
      content: String,
      tags: [String],
      publishedOn: {
        $type: Date,
        $default: () => new Date()
      },
      publishedBy: String,
      email: {
        $type: String,
        $limit: predefine('@email')
      },
      status: Number,
      viewCount: {
        $type: Number,
        $limit: range(1, 30)
      },
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
