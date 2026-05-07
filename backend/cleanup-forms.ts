import mongoose from 'mongoose';
import { Form } from './src/models/Form.js';
import 'dotenv/config';

async function cleanup() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school-portal';
    await mongoose.connect(uri);
    console.log('Connected to DB');
    
    const result = await Form.deleteMany({ title: 'Untitled form' });
    console.log(`Deleted ${result.deletedCount} untitled forms`);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

cleanup();
