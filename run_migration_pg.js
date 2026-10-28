const fs = require('fs');
const { Client } = require('pg');

async function runMigration() {
  const sql = fs.readFileSync('supabase/migrations/20251028000000_init_ziko.sql', 'utf8');
  
  // Try direct connection
  const client = new Client({
    connectionString: 'postgresql://postgres.bfxncfndinmiykwazbxc:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected');
    await client.query(sql);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

runMigration();
