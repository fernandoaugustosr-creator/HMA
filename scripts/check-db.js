const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
let envConfig = '';
try {
  envConfig = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error('Could not read .env.local');
  process.exit(1);
}

const env = {};
envConfig.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

console.log('Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Checking connection to Supabase...');
  // Try to select from a table that should exist
  const { data, error } = await supabase.from('nurses').select('*').limit(1);
  
  if (error) {
    console.error('Error connecting to Supabase:', error.message);
    if (error.code === 'PGRST204' || error.message.includes('relation "public.nurses" does not exist')) {
        console.log('TABLES_MISSING');
    }
  } else {
    console.log('Connection successful.');
    console.log('DB_OK');
  }
}

check();
