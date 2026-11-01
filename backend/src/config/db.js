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

  // Configure connection options
  const mongooseOptions = {};

  // For MongoDB Atlas clusters (mongodb+srv://), users created via Atlas UI reside
  // in the 'admin' authentication database. If authSource is omitted from the URI,
  // MongoDB driver defaults to authenticating against the target application DB, causing
  // "bad auth : Authentication failed". Defaulting authSource to 'admin' fixes this.
  if (mongoUri.startsWith('mongodb+srv://') && !mongoUri.includes('authSource=')) {
    mongooseOptions.authSource = process.env.MONGO_AUTH_SOURCE || 'admin';
  } else if (process.env.MONGO_AUTH_SOURCE) {
    mongooseOptions.authSource = process.env.MONGO_AUTH_SOURCE;
  }

  try {
    const conn = await mongoose.connect(mongoUri, mongooseOptions);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    if (error.message && (error.message.includes('Authentication failed') || error.message.includes('bad auth'))) {
      console.error('\n📋 [Atlas Diagnostics] Authentication Failure detected:');
      console.error('  1. Check Atlas Database Access: User must exist with Authentication Method = Password.');
      console.error('  2. Special characters in URI: Password must be percent-encoded (e.g. @ -> %40, # -> %23, $ -> %24, ! -> %21) or use alphanumeric characters.');
      console.error('  3. Auth Source: Atlas credentials live in "admin" db (use &authSource=admin in URI).');
      console.error('  4. Network Access (Render): In cloud.mongodb.com -> Network Access, add 0.0.0.0/0 (Allow Access from Anywhere).\n');
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Will retry connecting to MongoDB on next request or restart...');
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
