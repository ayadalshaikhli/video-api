import { createActivityTables } from './lib/db/createActivityTables.js';
import { addSampleData } from './utils/sampleData.js';

async function testActivityTables() {
  try {
    console.log('Creating activity tables...');
    await createActivityTables();
    
    console.log('Adding sample data...');
    await addSampleData('ae146e6e-de4a-4151-b093-d3ebd9c52c99'); // Your clinic ID
    
    console.log('✅ Activity tables and sample data created successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testActivityTables(); 