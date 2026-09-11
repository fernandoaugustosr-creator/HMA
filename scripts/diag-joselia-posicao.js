require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== JOSELIA ENFERMEIRO(SEL) - ID especifico nos ROSTERS ===\n');

  // Joselia ENF SEL = 0d9f4f86...
  // Joselia TEC CONCURSO = 7e60cdf6...
  const joseliaEnfId = '0d9f4f86-9f3f-4b29-9520-5020e6b507f3';
  const joseliaTecId = '7e60cdf6-3526-4d4b-8797-6281c3e75913';

  const { data: units } = await sb.from('units').select('id, title');
  const umap = Object.fromEntries(units.map(u=>[u.id,u.title]));

  for (const [nid, label] of [[joseliaEnfId, 'JOSELIA ENF (SEL)'], [joseliaTecId, 'JOSELIA TEC (CONCURSO)']]) {
    const { data: nurse } = await sb.from('nurses').select('*').eq('id', nid);
    console.log(label + ' [cadastro nurses]:', nurse && nurse[0] ?
      'role=' + nurse[0].role + ' | vinc=' + nurse[0].vinculo + ' | coren=' + nurse[0].coren : 'NAO ENCONTRADO');

    const { data: ros } = await sb
      .from('monthly_rosters')
      .select('id, unit_id, month, year, sector, list_order, observation, name_star, created_at')
      .eq('nurse_id', nid)
      .gte('month', 6).lte('month', 9).eq('year', 2026);

    console.log(label + ' [rosters meses 6-9/2026]:');
    if (!ros || ros.length === 0) console.log('   >>> NENHUM ROSTER NESSES MESES <<<');
    (ros||[]).sort((a,b)=> (a.year*12+a.month)-(b.year*12+b.month)).forEach(r => {
      console.log('   ' + r.year + '/' + String(r.month).padStart(2,'0') +
        '  Unit=' + String(umap[r.unit_id]||'???').padEnd(30).substring(0,30) +
        '  list_order=' + String(r.list_order||'null').padEnd(6) +
        '  sector=' + String(r.sector||'-').padEnd(15) +
        '  name_star=' + r.name_star);
    });

    // Conta shifts nesses meses
    const { count } = await sb
      .from('shifts')
      .select('*', {count:'exact', head:true})
      .eq('nurse_id', nid)
      .gte('date', '2026-06-01')
      .lte('date', '2026-09-30');
    console.log('   Qtd shifts (jun-set):', count);
    console.log('');
  }

  // POSTO 1 AGOSTO: lista completa com list_order para ver a ordem
  const posto1 = units.find(u => (u.title||'').toUpperCase().includes('POSTO 1') &&
    !(u.title||'').toUpperCase().includes('TRAUMA') && !(u.title||'').toUpperCase().includes('POSTO 2'));
  if (!posto1) return;

  console.log('\n=== POSTO 1 AGOSTO 2026: ROSTER COMPLETO pela ordem da lista ===\n');
  const { data: rosAgosto } = await sb
    .from('monthly_rosters')
    .select('nurse_id, list_order, sector, name_star, id')
    .eq('unit_id', posto1.id).eq('month',8).eq('year',2026);
  const ids = (rosAgosto||[]).map(r=>r.nurse_id);
  const { data: ns } = await sb.from('nurses').select('id,name,role,vinculo').in('id', ids.length? ids:['00000000-0000-0000-0000-000000000000']);
  const nmap = Object.fromEntries((ns||[]).map(n=>[n.id,n]));
  const ordered = (rosAgosto||[]).slice().sort((a,b)=> (a.list_order||99999) - (b.list_order||99999));
  ordered.forEach((r,i) => {
    const n = nmap[r.nurse_id] || {name:'???',role:'-',vinculo:'-'};
    const marc = (n.id === joseliaEnfId ? '  <<< JOSELIA ENF SEL' : (n.id === joseliaTecId ? '  <<< JOSELIA TEC' : ''));
    console.log(String(i+1).padStart(2) + ' | ord=' + String(r.list_order||'').padEnd(5) + ' | ' +
      String(n.name).padEnd(40).substring(0,40) + ' | ' +
      String(n.role||'-').padEnd(14) + ' | vinc=' + String(n.vinculo||'-').padEnd(14) + marc);
  });
})();
