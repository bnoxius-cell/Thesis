import mongoose from 'mongoose'

const ensureTaskShareTagIndex = async () => {
    const collection = mongoose.connection.db.collection('tasks');

    try {
        const indexes = await collection.indexes();
        const shareTagIndex = indexes.find((index) => index.name === 'shareTag_1');

        if (shareTagIndex && (!shareTagIndex.unique || !shareTagIndex.sparse)) {
            await collection.dropIndex('shareTag_1');
        }

        await collection.updateMany({ shareTag: null }, { $unset: { shareTag: '' } });
        await collection.createIndex(
            { shareTag: 1 },
            { unique: true, sparse: true, name: 'shareTag_1' }
        );
    } catch (error) {
        if (error.codeName !== 'NamespaceNotFound') {
            console.error('Task share code index setup failed:', error.message);
        }
    }
};

const connectDB = async () => {
    mongoose.connection.on('connected', () => {
        console.log(`Database connected at port: ${mongoose.connection.host}:${mongoose.connection.port}`)
    })
    await mongoose.connect(process.env.MONGO_URI);
    await ensureTaskShareTagIndex();
}

export default connectDB;
