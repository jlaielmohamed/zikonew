const fs = require('fs');

async function runMigration() {
  const sql = fs.readFileSync('supabase/migrations/20251028000000_init_ziko.sql', 'utf8');
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeG5jZm5kaW5taXlrd2F6YnhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzE3ODU3NiwiZXhwIjoyMTA4NzU0NTc2fQ.eKKZN0EHbCJ30rz5WVGvxM3YdNB3bwosghix1njUGT4';
  
  try {
    const response = await fetch('https://bfxncfndinmiykwazbxc.supabase.co/rest/v1/rpc/exec_sql', {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    });
    
    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runMigration();
