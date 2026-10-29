import mongoose, { Mongoose } from 'mongoose';
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
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
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // A healthy connect takes about a second. Waiting 30s (the default) on a
      // blip only to fail anyway left no time to try again inside one request.
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    };
    // One retry. The database server stays up; what fails is the occasional
    // connection from Vercel (3 in 4 days, Oct 2026), and a second attempt a
    // moment later almost always gets through, so the request does not fail.
    const connectOnce = () => mongoose.connect(MONGODB_URI!, opts);
    cached.promise = connectOnce().catch(async () => {
      await mongoose.disconnect().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return connectOnce();
    }).then((mongooseInstance) => {
      return mongooseInstance;
    }).catch(err => {
      console.error("MongoDB: Connection error:", err);
      cached.promise = null; 
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}
export default dbConnect;