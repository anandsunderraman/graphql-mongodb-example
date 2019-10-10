import {MongoClient, ObjectId} from 'mongodb'
import express from 'express'
import bodyParser from 'body-parser'
import {graphqlExpress, graphiqlExpress} from 'graphql-server-express'
import {makeExecutableSchema} from 'graphql-tools'
import cors from 'cors'
import {prepare} from "../util/index"


const app = express()

app.use(cors())

const homePath = '/graphiql'
const URL = 'http://localhost'
const PORT = 3001
const MONGO_URL = 'mongodb://localhost:27017/blog'



export const start = async () => {
  try {
    const db = await MongoClient.connect(MONGO_URL)

    const Posts = db.collection('posts')
    const Comments = db.collection('comments')
    const Like = db.collection('like')

    const typeDefs = [`
      type Query {
        post(_id: String): Post
        posts: [Post]
        comment(_id: String): Comment
        like(_id: String): Like
        likes: [Like]
      }

      type Post {
        _id: String
        title: String
        content: String
        comments: [Comment]
        like: Like
      }

      type Comment {
        _id: String
        postId: String
        content: String
        post: Post
        like: Like
      }

      type Like {
        _id: String
        commentId: String
        postId: String
        count: Int
      }

      type Mutation {
        createPost(title: String, content: String): Post
        createComment(postId: String, content: String): Comment
        likeComment(commentId: String, count: Int): Like
        likePost(postId: String, count: Int): Like
      }

      schema {
        query: Query
        mutation: Mutation
      }
    `];

    const resolvers = {
      Query: {
        post: async (root, {_id}) => {
          return prepare(await Posts.findOne(ObjectId(_id)))
        },
        posts: async () => {
          return (await Posts.find({}).toArray()).map(prepare)
        },
        comment: async (root, {_id}) => {
          return prepare(await Comments.findOne(ObjectId(_id)))
        },
        like: async (root, {_id}) => {
          return prepare(await Like.findOne(ObjectId(_id)))
        },
        likes: async () => {
          return (await Like.find({}).toArray()).map(prepare)
        }
      },
      Post: {
        comments: async ({_id}) => {
          return (await Comments.find({postId: _id}).toArray()).map(prepare)
        },
        like: async ({_id}) => {
          return (await Like.findOne({postId: _id}))
        }
      },
      Comment: {
        post: async ({postId}) => {
          return prepare(await Posts.findOne(ObjectId(postId)))
        },
        like: async ({_id}) => {
          return prepare(await Like.findOne({commentId: _id}))
        }
      },
      Mutation: {
        createPost: async (root, args, context, info) => {
          const res = await Posts.insertOne(args)
          return prepare(res.ops[0])  // https://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#~insertOneWriteOpResult
        },
        createComment: async (root, args) => {
          const res = await Comments.insert(args)
          return prepare(await Comments.findOne({_id: res.insertedIds[1]}))
        },
        likeComment: async (root, args) => {
          const res = await Like.insert(args)
          return prepare(await Like.findOne({_id: res.insertedIds[1]}))
        },
        likePost: async (root, args) => {
          const res = await Like.insert(args)
          return prepare(await Like.findOne({_id: res.insertedIds[1]}))
        }
      },
    }

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    })


    app.use('/graphql', bodyParser.json(), graphqlExpress({schema}))


    app.use(homePath, graphiqlExpress({
      endpointURL: '/graphql'
    }))

    app.listen(PORT, () => {
      console.log(`Visit ${URL}:${PORT}${homePath}`)
    })

  } catch (e) {
    console.log(e)
  }

}
