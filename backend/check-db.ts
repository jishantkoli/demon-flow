import 'dotenv/config';
import mongoose from 'mongoose';
import { Form } from './src/models/Form.js';
import { connectDB } from './src/config/db.js';

async function checkForms() {
  await connectDB();
  const forms = await Form.find({});
  console.log('Total forms found:', forms.length);
  forms.forEach(f => console.log(`- ${f.title} (${f.status})`));
  process.exit(0);
}

checkForms();
