const mongoose = require('mongoose');

// Configure Mongoose options
mongoose.set('bufferTimeoutMS', 20000);

const connectDB = async () => {
  const directAtlasUri = 'mongodb://mayurvish:Mayur2003%21%40%23%24@ac-6pitufb-shard-00-00.pqjcnsk.mongodb.net:27017,ac-6pitufb-shard-00-01.pqjcnsk.mongodb.net:27017,ac-6pitufb-shard-00-02.pqjcnsk.mongodb.net:27017/q2connect?ssl=true&replicaSet=atlas-rxulwo-shard-0&authSource=admin&retryWrites=true&w=majority';
  const envUri = process.env.MONGODB_URI;
  const localUri = 'mongodb://127.0.0.1:27017/q2connect';

  // Strategy order:
  // 1. Direct Atlas ReplicaSet URI (bypasses Windows querySrv DNS timeout)
  // 2. MONGODB_URI from environment
  // 3. Local MongoDB on port 27017
  const candidates = [directAtlasUri, envUri, localUri].filter(Boolean);

  for (const uri of candidates) {
    try {
      const isAtlas = uri.includes('mongodb.net');
      const conn = await mongoose.connect(uri, {
        maxPoolSize: 50,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host} (${isAtlas ? 'Atlas Cloud Cluster' : 'Local Instance'})`);
      return conn;
    } catch (error) {
      console.warn(`⚠️ MongoDB connection attempt failed for [${uri.replace(/:([^:@]+)@/, ':****@')}]: ${error.message}`);
    }
  }

  console.error('❌ FATAL CONFIGURATION ERROR: Unable to establish connection to any MongoDB target.');
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
};

module.exports = connectDB;
