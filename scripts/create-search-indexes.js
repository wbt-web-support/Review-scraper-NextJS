const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/review-scraper';

async function createSearchIndexes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const widgets = db.collection('widgets');
    
    // Create text index for search functionality
    console.log('Creating text index on widget names...');
    await widgets.createIndex(
      { name: 'text' },
      { 
        name: 'widget_search_index',
        background: true 
      }
    );
    
    // Create compound index for pagination and filtering
    console.log('Creating compound index for pagination...');
    await widgets.createIndex(
      { 
        userId: 1, 
        createdAt: -1,
        name: 1 
      },
      { 
        name: 'widget_pagination_index',
        background: true 
      }
    );
    
    // Create index for business URL lookups
    console.log('Creating index for business URL filtering...');
    await widgets.createIndex(
      { 
        userId: 1,
        businessUrlId: 1,
        businessUrlSource: 1
      },
      { 
        name: 'widget_business_url_index',
        background: true 
      }
    );
    
    console.log('✅ All search indexes created successfully!');
    
    // List all indexes to verify
    const indexes = await widgets.indexes();
    console.log('\nCurrent indexes:');
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  } finally {
    await client.close();
  }
}

// Run the script
if (require.main === module) {
  createSearchIndexes()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { createSearchIndexes };
