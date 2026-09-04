const mongoose = require('mongoose');
const dns = require('dns');

// On Windows, local ISP DNS often fails on MongoDB SRV queries (querySrv ECONNREFUSED).
// Setting reliable DNS servers solves this seamlessly.
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (err) {
  console.warn('DNS server override notice:', err.message);
}

const ACTUAL_MONGODB_URI = 'mongodb+srv://mayurvish:Mayur2003%21%40%23%24@complete-backend.pqjcnsk.mongodb.net/q2connect?retryWrites=true&w=majority';

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || ACTUAL_MONGODB_URI;
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // In development with nodemon, log and retry rather than abruptly killing the process
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Will retry connecting to MongoDB on next request or restart...');
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
