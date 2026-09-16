require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data: unit } = await supabase.from('units').select('id,title').ilike('title', '%OBSTETRÍCIA%').single();
  console.log('UNIT', unit);
  const { data, error } = await supabase
    .from('monthly_rosters')
    .select('id,nurse_id,unit_id,section_id,month,year,nurses(id,name,role,coren,crm)')
    .eq('month', 8)
    .eq('year', 2026)
    .eq('unit_id', unit.id)
    .order('created_at');
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
})();
