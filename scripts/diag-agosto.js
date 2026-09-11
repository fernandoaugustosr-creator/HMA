require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== DIAGNOSTICO AGOSTO/2026 POR UNIDADE ===\n');

  const { data: units, error: ue } = await sb.from('units').select('id, title').order('title');
  if (ue) { console.log('ERRO units:', ue.message); return; }
  console.log('Total de unidades:', units.length);

  const { data: rosters, error: re } = await sb
    .from('monthly_rosters')
    .select('id, nurse_id, unit_id, section_id, sector')
    .eq('month', 8).eq('year', 2026);
  if (re) { console.log('ERRO rosters:', re.message); return; }
  console.log('Total monthly_rosters AGOSTO/2026:', rosters.length);

  const { data: shiftsAug, error: se } = await sb
    .from('shifts')
    .select('id, nurse_id, roster_id, date, type')
    .gte('date', '2026-08-01')
    .lte('date', '2026-08-31');
  if (se) { console.log('ERRO shifts agosto:', se.message); }
  console.log('Total shifts AGOSTO/2026 por faixa de data:', (shiftsAug||[]).length);

  const byUnit = {};
  rosters.forEach(r => {
    if (!byUnit[r.unit_id]) byUnit[r.unit_id] = { rosterCount: 0, shiftCount: 0, sectors: new Set() };
    byUnit[r.unit_id].rosterCount++;
    if (r.sector) byUnit[r.unit_id].sectors.add(r.sector);
  });
  const rosterIdToUnit = {};
  const nurseIdToUnit = {};
  rosters.forEach(r => {
    rosterIdToUnit[r.id] = r.unit_id;
    nurseIdToUnit[r.nurse_id] = r.unit_id;
  });

  (shiftsAug||[]).forEach(s => {
    const uid = rosterIdToUnit[s.roster_id] || nurseIdToUnit[s.nurse_id];
    if (uid && byUnit[uid]) byUnit[uid].shiftCount++;
  });

  console.log('\n=== DETALHE POR UNIDADE (AGOSTO/2026) ===');
  const lines = [];
  Object.entries(byUnit).forEach(([uid, info]) => {
    const u = units.find(x => x.id === uid);
    const title = (u ? u.title : '???').padEnd(50).substring(0, 50);
    lines.push(
      ' [' + title + '] rosters=' + String(info.rosterCount).padStart(4) +
      ' | shifts=' + String(info.shiftCount).padStart(6) +
      ' | sectors=' + [...info.sectors].length
    );
  });
  lines.sort().forEach(l => console.log(l));

  console.log('\n=== METADATA DE LIBERACAO AGOSTO/2026 ===');
  const {data: meta, error: me} = await sb.from('monthly_schedule_metadata').select('unit_id, is_released, dynamic_field').eq('month',8).eq('year',2026);
  if (me) console.log('ERRO meta:', me.message);
  else {
    const metaLines = [];
    (meta||[]).forEach(m => {
      const u = units.find(x => x.id === m.unit_id);
      const info = byUnit[m.unit_id] || {rosterCount:0, shiftCount:0};
      const title = ((u?.title||'???')).padEnd(50).substring(0, 50);
      metaLines.push(' - ' + title +
        ' released=' + m.is_released +
        ' | dynamic=' + String(m.dynamic_field).padEnd(8) +
        ' | rosters=' + info.rosterCount + ' shifts=' + info.shiftCount);
    });
    metaLines.sort().forEach(l => console.log(l));
  }
})();
