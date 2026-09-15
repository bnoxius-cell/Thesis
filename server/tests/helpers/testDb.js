import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Shared helper for spinning up a throwaway, in-memory MongoDB per test file.
// Nothing here ever touches the real Atlas cluster in server/.env.
let mongod;

export const connectTestDB = async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
};

export const clearTestDB = async () => {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
};

export const closeTestDB = async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
};
