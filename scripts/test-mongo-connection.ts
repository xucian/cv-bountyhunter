/**
 * Test MongoDB connection directly to see the actual error
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function testConnection() {
  console.log('Testing MongoDB connection...');
  console.log('URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Hide password

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    console.log('\nAttempting to connect...');
    await client.connect();
    console.log('✓ Connection successful!');

    const db = client.db('codebounty');
    const collections = await db.listCollections().toArray();
    console.log('\n✓ Available collections:', collections.map(c => c.name));

    const chunksCollection = db.collection('code_chunks');
    const count = await chunksCollection.countDocuments();
    console.log(`✓ code_chunks collection has ${count} documents`);

    await client.close();
    console.log('\n✓ Connection test passed');
  } catch (error) {
    console.error('\n✗ Connection failed:');
    console.error('Error name:', (error as any).name);
    console.error('Error message:', (error as any).message);
    console.error('\nFull error:', error);

    if ((error as any).name === 'MongoNetworkError') {
      console.error('\nThis is a network-level error. Possible causes:');
      console.error('  - DNS resolution failure');
      console.error('  - IP not whitelisted in MongoDB Atlas');
      console.error('  - Cluster is paused');
      console.error('  - Firewall blocking connection');
    }

    process.exit(1);
  }
}

testConnection();
