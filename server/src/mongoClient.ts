import { MongoClient, Db } from 'mongodb';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gameserver';
export const mongoClient = new MongoClient(mongoUri);

export async function getDb(): Promise<Db> {
  await mongoClient.connect(); // Safe to call multiple times
  return mongoClient.db();
} 