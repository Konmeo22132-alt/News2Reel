/**
 * MongoDB connection singleton — reuses connection across hot-reloads in dev.
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Thiếu biến môi trường MONGODB_URI. Thêm vào .env:\nMONGODB_URI=mongodb://localhost:27017/autovideo"
  );
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalCache = globalThis as typeof globalThis & { mongoose?: MongooseCache };

if (!globalCache.mongoose) {
  globalCache.mongoose = { conn: null, promise: null };
}

const cache = globalCache.mongoose;

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI as string, {
      bufferCommands: false,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
