import mongoose from 'mongoose'

const connectDB = async () => {
    mongoose.connection.on('connected', () => {
        console.log(`Database connected at port: ${mongoose.connection.host}:${mongoose.connection.port}`)
    })
    await mongoose.connect(process.env.MONGO_URI);
}

export default connectDB;