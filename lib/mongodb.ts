import mongoose, { Mongoose } from 'mongoose';
const MONGODB_URI_TEST = process.env.MONGODB_URI_TEST;
if (!MONGODB_URI_TEST) {
  throw new Error(
    'Please define the MONGODB_URI_TEST environment variable inside .env.local'
  );
}
interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}
declare global {
  var mongooseCache: MongooseCache;
}
let cached = global.mongooseCache;
if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}
async function dbConnect(): Promise<Mongoose> {
  if (cached.conn) {
    console.log("MongoDB: Using cached connection.");
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };
    console.log("MongoDB: Creating new connection promise.");
    cached.promise = mongoose.connect(MONGODB_URI_TEST!, opts).then((mongooseInstance) => {
      console.log("MongoDB: Connection successful!");
      return mongooseInstance;
    }).catch(err => {
      console.error("MongoDB: Connection error:", err);
      cached.promise = null; 
      throw err;
    });
  }

  try {
    console.log("MongoDB: Awaiting connection promise.");
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}
export default dbConnect;