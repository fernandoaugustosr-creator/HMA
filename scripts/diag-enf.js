require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== DIAGNOSTICO DETALHADO - ENFERMEIROS AGOSTO/2026 ===\n');

  // Conta shifts com paginação (limite 1000 por chamada)
  let allShifts = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('shifts')
      .select('id, nurse_id, roster_id, date, type')
      .gte('date', '2026-08-01')
      .lte('date', '2026-08-31')
      .range(from, from + PAGE - 1);
    if (error) { console.log('ERRO shifts:', error.message); break; }
    allShifts = allShifts.concat(data || []);
    if ((data || []).length < PAGE) break;
    from += PAGE;
    if (from > 100000) break;
  }
  console.log('TOTAL REAL shifts AGOSTO/2026 (paginated):', allShifts.length);

  // Units + sections
  const { data: units } = await sb.from('units').select('id, title');
  const { data: sections } = await sb.from('sections').select('id, name');
  const unitMap = Object.fromEntries((units||[]).map(u => [u.id, u.title]));
  const sectionMap = Object.fromEntries((sections||[]).map(s => [s.id, s.name]));

  // Nurses com role, crm, coren
  const { data: nurses } = await sb.from('nurses').select('id, name, role, vinculo, crm, coren');
  const nurseMap = Object.fromEntries((nurses||[]).map(n => [n.id, n]));

  // Define o que é enfermeiro(a) de nível superior vs técnico
  function isEnfermeiroSuperior(n) {
    if (!n) return false;
    const r = (n.role||'').toLowerCase();
    const v = (n.vinculo||'').toLowerCase();
    return r.includes('enfermeir') && !r.includes('tecnic') && !r.includes('auxiliar')
      || v.includes('enfermeir') && !v.includes('tecnic') && !v.includes('auxiliar')
      || (n.coren && !n.role && !n.vinculo);
  }
  function isTecnicoAuxiliar(n) {
    if (!n) return false;
    const r = (n.role||'').toLowerCase();
    const v = (n.vinculo||'').toLowerCase();
    return r.includes('tecnic') || r.includes('auxiliar') || v.includes('tecnic') || v.includes('auxiliar');
  }
  function isMedico(n) {
    if (!n) return false;
    return !!n.crm || (n.role||'').toLowerCase().includes('medic') || (n.vinculo||'').toLowerCase().includes('medic');
  }

  // Roster agosto 2026 com join
  const { data: rosters } = await sb
    .from('monthly_rosters')
    .select('id, nurse_id, unit_id, section_id, sector, list_order')
    .eq('month', 8).eq('year', 2026);

  const rosterIdToUnit = {};
  const nurseIdToUnit = {};
  const rostersByUnit = {};
  (rosters||[]).forEach(r => {
    rosterIdToUnit[r.id] = r.unit_id;
    nurseIdToUnit[r.nurse_id] = r.unit_id;
    if (!rostersByUnit[r.unit_id]) rostersByUnit[r.unit_id] = [];
    rostersByUnit[r.unit_id].push(r);
  });

  // Shifts por unidade (todos)
  const shiftsByUnit = {};
  allShifts.forEach(s => {
    const uid = rosterIdToUnit[s.roster_id] || nurseIdToUnit[s.nurse_id];
    if (uid) {
      if (!shiftsByUnit[uid]) shiftsByUnit[uid] = [];
      shiftsByUnit[uid].push(s);
    }
  });

  console.log('\n=== DETALHES POR UNIDADE (CATEGORIAS) ===');
  Object.keys(rostersByUnit).sort().forEach(uid => {
    const u = unitMap[uid] || '???';
    const rs = rostersByUnit[uid];
    const ss = shiftsByUnit[uid] || [];
    
    let enfermeirosCount = 0, tecnicosCount = 0, medicosCount = 0, outrosCount = 0;
    const sections = new Set();
    rs.forEach(r => {
      const n = nurseMap[r.nurse_id];
      if (r.section_id) sections.add(sectionMap[r.section_id] || r.section_id.substring(0,6));
      if (isMedico(n)) medicosCount++;
      else if (isEnfermeiroSuperior(n)) enfermeirosCount++;
      else if (isTecnicoAuxiliar(n)) tecnicosCount++;
      else outrosCount++;
    });
    
    const summary = [];
    if (enfermeirosCount) summary.push('ENF=' + enfermeirosCount);
    if (tecnicosCount) summary.push('TEC/AUX=' + tecnicosCount);
    if (medicosCount) summary.push('MED=' + medicosCount);
    if (outrosCount) summary.push('OUTROS=' + outrosCount);
    
    const cat = summary.join(' ') || '(sem categorizar)';
    console.log(' [' + String(u).padEnd(48).substring(0,48) + '] rosters=' + String(rs.length).padStart(4) +
      ' shifts=' + String(ss.length).padStart(5) + ' | ' + cat +
      (sections.size ? ' | sections: ' + [...sections].join(', ') : ''));
  });

  // Unidades que existem no metadata mas nao tem rosters
  console.log('\n=== UNIDADES LIBERADAS SEM ROSTERS (VAZIAS) ===');
  const {data: meta} = await sb.from('monthly_schedule_metadata').select('unit_id, is_released').eq('month',8).eq('year',2026);
  (meta||[]).filter(m => !rostersByUnit[m.unit_id] && m.is_released).forEach(m => {
    console.log(' - ' + (unitMap[m.unit_id] || '???') + ' (released=true, SEM rosters, SEM shifts)');
  });

  // Enfermeiros cadastrados que NAO aparecem em nenhum roster agosto 2026
  console.log('\n=== ENFERMEIROS (SUPERIOR) CADASTRADOS MAS SEM ROSTER AGOSTO ===');
  const idsNoRoster = new Set(Object.keys(nurseMap));
  (rosters||[]).forEach(r => idsNoRoster.delete(r.nurse_id));
  const semRoster = [...idsNoRoster].map(id => nurseMap[id]).filter(isEnfermeiroSuperior);
  console.log('Total enfermeiros superior cadastrados total:', (nurses||[]).filter(isEnfermeiroSuperior).length);
  console.log('Enfermeiros superior SEM roster agosto 2026:', semRoster.length);
  semRoster.slice(0, 30).forEach(n => {
    console.log('  - ' + n.name + ' | role=' + (n.role||'-') + ' vinc=' + (n.vinculo||'-') + ' coren=' + (n.coren||'-'));
  });
  if (semRoster.length > 30) console.log('  ... mais ' + (semRoster.length-30) + ' registros');
})();
