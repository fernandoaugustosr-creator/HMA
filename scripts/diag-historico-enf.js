require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: units } = await sb.from('units').select('id, title');
  const psEnf = units.find(u => /PRONTO.*SOCORRO.*ENFERM/i.test(u.title));
  if (!psEnf) { console.log('PRONTO SOCORRO ENFERMEIRO nao encontrado no units!'); return; }
  console.log('=== UNIDADE ALVO:', psEnf.title, 'id=' + psEnf.id.substring(0,8) + '...');
  console.log('');

  // 1) Histórico de rosters de 2026 nesta unidade
  console.log('--- HISTORICO DE ROSTERS MENSAL nesta unidade (2026): ---');
  const { data: rosAll } = await sb.from('monthly_rosters')
    .select('nurse_id, unit_id, month, year, sector, list_order, id')
    .eq('unit_id', psEnf.id).eq('year', 2026);
  const rosCountByMonth = {};
  (rosAll||[]).forEach(r => {
    if (!rosCountByMonth[r.month]) rosCountByMonth[r.month] = [];
    rosCountByMonth[r.month].push(r);
  });
  for (let m=1; m<=12; m++) {
    const arr = rosCountByMonth[m] || [];
    if (arr.length) {
      const nids = arr.map(r => r.nurse_id);
      const { data: ns } = await sb.from('nurses').select('id,name,role,vinculo,coren').in('id', nids);
      const noms = (ns||[]).map(n => n.name + ' (' + (n.role||'-') + '/' + (n.vinculo||'-') + ')');
      console.log('  MES ' + m + ': ' + arr.length + ' profissionais | Shifts(por nurse_id)=');
      // Conta shifts
      const dateF = '2026-' + String(m).padStart(2,'0') + '-01';
      const dateT = '2026-' + String(m).padStart(2,'0') + '-31';
      const { count } = await sb.from('shifts').select('*',{count:'exact', head:true})
        .in('nurse_id', nids).gte('date', dateF).lte('date', dateT);
      console.log('        Rosters:', arr.length, '| Shifts(nurse_ids):', count);
      noms.slice(0, 12).forEach(nm => console.log('        - ' + nm));
      if (noms.length > 12) console.log('        ... +', noms.length-12);
    }
  }
  if (Object.keys(rosCountByMonth).length === 0) console.log('  >>> NENHUM roster NENHUM mes nesta unidade em 2026! <<<');

  // 2) Mesmo para UTI ENFERMEIROS e NIR (unidades que tinham em junho)
  for (const unamePat of [/UTI.*ENFERM/i, /^NIR$/i, /CLASSIFIC.*RISCO/i]) {
    console.log('\n-----------------------');
    const u = units.find(x => unamePat.test(x.title));
    if (!u) continue;
    console.log('Unidade:', u.title);
    const { data: ros } = await sb.from('monthly_rosters').select('nurse_id,unit_id,month,year').eq('unit_id',u.id).gte('month',1).lte('month',8).eq('year',2026);
    const grp = {};
    (ros||[]).forEach(r => { if(!grp[r.month]) grp[r.month]=[]; grp[r.month].push(r.nurse_id); });
    for (let m=1; m<=8; m++) {
      const nids = grp[m] || [];
      if (nids.length) {
        const {count} = await sb.from('shifts').select('*',{count:'exact',head:true})
          .in('nurse_id', nids).gte('date','2026-'+String(m).padStart(2,'0')+'-01').lte('date','2026-'+String(m).padStart(2,'0')+'-31');
        console.log('  MES '+m+': rosters=' + nids.length + ' shifts(nurse)=' + count);
      } else console.log('  MES '+m+': vazio.');
    }
  }

  // 3) Busca GENERICA: qual unidade TEM os enfermeiros.
  //    Quais units tem mais de 3 ENFs nos ultimos 3 meses?
  console.log('\n=== MAPA GERAL DE UNIDADES COM >= 3 ENFERMEIROS ALGUM MÊS (1-8/2026) ===\n');
  // Primeiro carrega todos nurses
  const { data: allN } = await sb.from('nurses').select('id,name,role,vinculo,coren,crm');
  function ehENF(n) {
    const rl=(n.role||'').toLowerCase();
    const vl=(n.vinculo||'').toLowerCase();
    if (n.crm && n.crm.trim()) return false;
    const temE = rl.includes('enfermeir') || vl.includes('enfermeir');
    const temT = rl.includes('tecnic') || rl.includes('auxiliar') || vl.includes('tecnic') || vl.includes('auxiliar');
    return temE && !temT;
  }
  const enfIds = new Set((allN||[]).filter(n => ehENF(n)).map(n=>n.id));
  console.log('Total enfermeiros (ids):', enfIds.length);

  if (enfIds.length) {
    const { data: todosRos } = await sb.from('monthly_rosters').select('nurse_id,unit_id,month,year').in('nurse_id', [...enfIds]).gte('month',1).lte('month',8).eq('year',2026);
    const agrega = {};
    (todosRos||[]).forEach(r => {
      const k = r.unit_id + '|' + r.month;
      if (!agrega[k]) agrega[k] = [];
      agrega[k].push(r.nurse_id);
    });
    const rows = [];
    Object.entries(agrega).forEach(([k, ids]) => {
      if (ids.length >= 3) {
        const [uid, m] = k.split('|');
        const title = uid ? (units.find(x=>x.id===uid)?.title||uid) : uid;
        rows.push({m: parseInt(m), uid, title, cnt: ids.length});
      }
    });
    rows.sort((a,b)=> (a.m-b.m));
    rows.forEach(r => {
      const dateF = '2026-' + String(r.m).padStart(2,'0') + '-01';
      const dateT = '2026-' + String(r.m).padStart(2,'0') + '-31';
      console.log('  MES ' + r.m + ' | ' + String(r.title).padEnd(40).substring(0,40) + ' | ' + r.cnt + ' ENFs alocados');
    });
  }
})();
