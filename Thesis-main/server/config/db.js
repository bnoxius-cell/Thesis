import mongoose from 'mongoose'

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is missing. Create Thesis-main/server/.env and add your MongoDB connection string.')
    }

    mongoose.connection.on('connected', () => {
        console.log(`Database connected at port: ${mongoose.connection.host}:${mongoose.connection.port}`)
    })

    await mongoose.connect(process.env.MONGO_URI);
}

export default connectDB;
