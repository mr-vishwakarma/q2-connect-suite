require('dotenv').config();
const mongoose = require('mongoose');

async function checkCounts() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const c of collections) {
    const count = await mongoose.connection.db.collection(c.name).countDocuments();
    console.log(`- ${c.name}: ${count}`);
  }
  await mongoose.disconnect();
}

checkCounts().catch(console.error);
