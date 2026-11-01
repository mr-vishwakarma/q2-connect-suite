const mongoose = require('mongoose');
const { URL } = require('url');

// Configure Mongoose options
mongoose.set('bufferTimeoutMS', 20000);

/**
 * Safely inspects a MongoDB connection URI for diagnostic logging.
 * STRICT SECURITY: NEVER returns or logs usernames, passwords, or complete connection strings.
 */
function getSafeUriDiagnostics(rawUri) {
  if (!rawUri || typeof rawUri !== 'string' || !rawUri.trim()) {
    return { present: false, reason: 'EMPTY_OR_UNDEFINED' };
  }

  const trimmed = rawUri.trim();
  const hadLeadingTrailingWhitespace = trimmed !== rawUri;
  const isSrv = trimmed.startsWith('mongodb+srv://');
  const isStandard = trimmed.startsWith('mongodb://');

  if (!isSrv && !isStandard) {
    return {
      present: true,
      validScheme: false,
      hadLeadingTrailingWhitespace,
      detectedPrefix: trimmed.slice(0, 15),
    };
  }

  const scheme = isSrv ? 'mongodb+srv' : 'mongodb';

  try {
    const pseudoUrl = trimmed.replace(/^mongodb(\+srv)?:\/\//, 'https://');
    const parsed = new URL(pseudoUrl);

    const pathPart = parsed.pathname ? parsed.pathname.replace(/^\//, '').split('/')[0] : '';
    const databaseName = pathPart.split('?')[0].trim() || null;
    const authSource = parsed.searchParams.get('authSource') || null;
    const retryWrites = parsed.searchParams.get('retryWrites') || null;
    const hasUsername = Boolean(parsed.username);
    const hasPassword = Boolean(parsed.password);

    return {
      present: true,
      validScheme: true,
      scheme,
      host: parsed.host || '(unknown)',
      databaseName,
      authSource,
      hasCredentials: hasUsername && hasPassword,
      retryWrites,
      hadLeadingTrailingWhitespace,
    };
  } catch (err) {
    return {
      present: true,
      validScheme: true,
      scheme,
      parseError: err.message,
      hadLeadingTrailingWhitespace,
    };
  }
}

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || !mongoUri.trim()) {
    console.error('❌ FATAL CONFIGURATION ERROR: MONGODB_URI environment variable is required.');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw new Error('MONGODB_URI environment variable is required');
  }

  const trimmedUri = mongoUri.trim();
  const diagnostics = getSafeUriDiagnostics(mongoUri);

  // Safe startup diagnostics (Zero secret leakage)
  if (process.env.NODE_ENV !== 'test') {
    console.log('🔍 MongoDB Connection Diagnostics:');
    console.log(`   - Scheme: ${diagnostics.scheme || '(invalid)'}`);
    console.log(`   - Host: ${diagnostics.host || '(unknown)'}`);
    console.log(`   - Target Database: ${diagnostics.databaseName || '(none in URI path - will default to "test")'}`);
    console.log(`   - Auth Source: ${diagnostics.authSource || '(none in URI - defaults to target database)'}`);
    console.log(`   - Credentials Detected: ${diagnostics.hasCredentials ? 'Yes (username & password present)' : 'No'}`);

    if (diagnostics.hadLeadingTrailingWhitespace) {
      console.warn('⚠️ Leading or trailing whitespace detected in MONGODB_URI. Automatically trimmed for connection.');
    }

    if (!diagnostics.databaseName) {
      console.warn('⚠️ Warning: No database name specified in MONGODB_URI path. Mongoose will default to "test" database.');
    }

    if (diagnostics.scheme === 'mongodb+srv' && !diagnostics.authSource) {
      console.warn("ℹ️ Advisory: No '?authSource=admin' query parameter detected in MONGODB_URI. MongoDB Atlas users typically require authSource=admin.");
    }
  }

  try {
    const conn = await mongoose.connect(trimmedUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host} (Active Database: ${conn.connection.name})`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);

    if (error.message && (error.message.includes('bad auth') || error.message.includes('Authentication failed'))) {
      console.error('💡 Authentication Failure Troubleshooting Guide:');
      console.error('   1. Verify your password special characters are URL-encoded in MONGODB_URI (e.g. ! -> %21, @ -> %40, # -> %23, $ -> %24).');
      console.error('   2. Verify the username exists in MongoDB Atlas -> Security -> Database Access.');
      console.error('   3. Verify ?authSource=admin is appended to MONGODB_URI if user was created in Atlas admin auth database.');
      console.error('   4. Verify target database in URI path matches the database where user has permissions (e.g. /hosteliq_prodtest).');
      console.error('   5. Verify MongoDB Atlas -> Network Access allows 0.0.0.0/0 for dynamic cloud deployments (Render).');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Will retry connecting to MongoDB on next request or restart...');
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
