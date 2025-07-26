// scripts/dropSourceIdIndex.js
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGODB_URI || '';
  await mongoose.connect(uri);
  const indexes = await mongoose.connection.collection('reviews').getIndexes();
  console.log('Current indexes:', indexes);
  if ('sourceId_1' in indexes) {
    await mongoose.connection.collection('reviews').dropIndex('sourceId_1');
    console.log('Dropped index sourceId_1');
  } else {
    console.log('No sourceId_1 index found.');
  }
  await mongoose.disconnect();
})(); 