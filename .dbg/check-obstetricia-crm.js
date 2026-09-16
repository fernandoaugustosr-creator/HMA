require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data, error } = await supabase
    .from('monthly_rosters')
    .select('id,nurse_id,unit_id,month,year,nurses(id,name,role,coren,crm)')
    .eq('month', 8)
    .eq('year', 2026)
    .eq('unit_id', '3246f6af-950f-4805-8fa0-3abfbb7b4a76');
  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
