import 'dotenv/config';
import app from './app.js'; // Use .js for ESM compatibility
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  await connectDB();
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\uD83D\uDE80 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
};

startServer();
