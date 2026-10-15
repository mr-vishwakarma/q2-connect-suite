const mongoose = require('mongoose');

// Configure Mongoose options
mongoose.set('bufferTimeoutMS', 20000);

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || !mongoUri.trim()) {
    console.error('❌ FATAL CONFIGURATION ERROR: MONGODB_URI environment variable is required.');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw new Error('MONGODB_URI environment variable is required');
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Will retry connecting to MongoDB on next request or restart...');
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
