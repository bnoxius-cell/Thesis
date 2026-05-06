import mongoose from 'mongoose'

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        console.warn('MONGO_URI is missing. Server will run in demo mode with admin@student.fatima.edu.ph login only.');
        return false;
    }

    mongoose.connection.on('connected', () => {
        console.log(`Database connected at port: ${mongoose.connection.host}:${mongoose.connection.port}`)
    })

    await mongoose.connect(process.env.MONGO_URI);
    return true;
}

export default connectDB;
