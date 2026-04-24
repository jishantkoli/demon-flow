import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school-portal';
    const conn = await mongoose.connect(uri);
    console.log(`\u2705 MongoDB Connected: ${conn.connection.host}`);
  } catch (err: any) {
    console.error(`\u274C MongoDB Connection Error: ${err.message}`);
    process.exit(1);
  }
};
