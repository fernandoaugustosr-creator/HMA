require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data, error } = await supabase
    .from('units')
    .select('id,title')
    .or('title.ilike.%OBSTETR%,title.ilike.%OBSTETRI%')
    .order('title');
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
})();
