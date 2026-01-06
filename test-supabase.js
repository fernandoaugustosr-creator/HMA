const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envConfig = {}

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envConfig[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = envConfig['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = envConfig['NEXT_PUBLIC_SUPABASE_ANON_KEY']

console.log('URL:', supabaseUrl)
// Don't log the full key for security, just the start
console.log('Key:', supabaseKey ? supabaseKey.substring(0, 5) + '...' : 'MISSING')

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('Testing Supabase connection...')
  try {
    const { data, error } = await supabase.from('nurses').select('count', { count: 'exact', head: true })
    
    if (error) {
      console.error('Connection failed:', error.message)
      console.error('Details:', error)
    } else {
      console.log('Connection successful! Table "nurses" exists.')
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

testConnection()
