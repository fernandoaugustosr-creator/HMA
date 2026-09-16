require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const names = ['SILVANA MIGLIO COSTA','DANIEL LUIZ DOS PRAZERES CAMPOS','NICEMAR LOPES DE SOUSA','VICTOR HUGO FERNANDES'];
  const { data, error } = await supabase
    .from('nurses')
    .select('id,name,role,coren,crm,vinculo,section_id,unit_id')
    .in('name', names)
    .order('name');
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
})();
