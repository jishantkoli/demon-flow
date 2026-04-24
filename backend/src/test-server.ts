import 'dotenv/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from './app.js';
import { seedData } from './utils/seed.js';
import { User } from './models/User.js';

const startTestServer = async () => {
  try {
    const mongoServer = await MongoMemoryServer.create({
      instance: {
        launchTimeoutMS: 120000, // 2 minutes
      },
      binary: {
        version: '6.0.4', // Use a specific version to avoid latest resolution issues
        skipMD5: true,
      }
    });
    const uri = mongoServer.getUri();
    
    await mongoose.connect(uri);
    console.log('\u2705 In-memory MongoDB started');
    
    // Seed initial data if DB is empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await seedData(false, false);
      console.log('\u2705 Test data seeded');
    } else {
      console.log('\u2139\uFE0F DB already has data, skipping seed');
    }

    const PORT = process.env.PORT || 5001;
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🚀 Test Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err: any) {
    console.error('\u274C Test Server failed to start:', err.message);
    process.exit(1);
  }
};

startTestServer();
