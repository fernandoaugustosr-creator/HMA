require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== COMPARATIVO: JULHO vs AGOSTO 2026 - POSTO 1 ===\n');

  // Acha unit_id do POSTO 1
  const {data: units} = await sb.from('units').select('id, title');
  const posto1 = units.find(u => (u.title||'').toUpperCase().includes('POSTO 1') && !(u.title||'').toUpperCase().includes('TRAUMA') && !(u.title||'').toUpperCase().includes('POSTO 2'));
  if (!posto1) { console.log('POSTO 1 nao encontrado'); return; }
  console.log('POSTO 1 unit_id =', posto1.id, '|', posto1.title);

  // (sections (se existir)
  try {
    const {data: sections} = await sb.from('sections').select('id, name').limit(50);
    if (sections && sections.length)
      console.log('\nSections:', sections.map(s=>`${s.id.substring(0,6)}=${s.name}`).join('; '));
  } catch(e) { /* nao existe ou vazia */ }

  for (const [mesLabel, mesNum] of [['JULHO', 7], ['AGOSTO', 8]]) {
    console.log('\n========== ' + mesLabel + ' 2026 ==========');

    // Roster do Posto 1 no mes
    const {data: roster, error: re} = await sb
      .from('monthly_rosters')
      .select('id, nurse_id, unit_id, section_id, sector, list_order, name_star')
      .eq('unit_id', posto1.id)
      .eq('month', mesNum).eq('year', 2026)
      .order('list_order');
    if (re) { console.log('ERRO roster:', re.message); continue; }

    console.log('Total profissionais no roster:', roster.length);

    // Pega os nurses
    const nurseIds = roster.map(r => r.nurse_id);
    const {data: nursesData} = await sb.from('nurses').select('id, name, role, vinculo, coren, crm').in('id', nurseIds.length ? nurseIds : ['00000000-0000-0000-0000-000000000000']);
    const nurseMap = Object.fromEntries((nursesData||[]).map(n => [n.id, n]));

    // Conta shifts
    const rosterIds = roster.map(r => r.id);
    let shiftCount = {};
    if (rosterIds.length) {
      const dateFrom = `2026-${String(mesNum).padStart(2,'0')}-01`;
      const dateTo   = `2026-${String(mesNum).padStart(2,'0')}-31`;
      // Pagina shifts
      let shifts = [];
      let from = 0;
      while (true) {
        const {data, error} = await sb.from('shifts').select('nurse_id, roster_id, date').in('roster_id', rosterIds).range(from, from+999);
        if (error) break;
        shifts = shifts.concat(data||[]);
        if ((data||[]).length < 1000) break;
        from += 1000;
      }
      shifts.forEach(s => { shiftCount[s.nurse_id] = (shiftCount[s.nurse_id]||0) + 1; });
    }

    // Classifica
    let enfermeiros = [], tecnicos = [], medicos = [], outros = [];
    roster.forEach(r => {
      const n = nurseMap[r.nurse_id];
      if (!n) { outros.push({r, n, shifts: shiftCount[r.nurse_id]||0}); return; }
      const rl = (n.role||'').toLowerCase();
      const vl = (n.vinculo||'').toLowerCase();
      if (n.crm || rl.includes('medic') || vl.includes('medic')) medicos.push({r,n,shifts: shiftCount[r.nurse_id]||0});
      else if ( (rl.includes('enfermeir') && !rl.includes('tecnic') && !rl.includes('auxiliar')) || (vl.includes('enfermeir') && !vl.includes('tecnic') && !vl.includes('auxiliar')) )
        enfermeiros.push({r,n,shifts: shiftCount[r.nurse_id]||0});
      else if (rl.includes('tecnic') || rl.includes('auxiliar') || vl.includes('tecnic') || vl.includes('auxiliar'))
        tecnicos.push({r,n,shifts: shiftCount[r.nurse_id]||0});
      else outros.push({r,n,shifts: shiftCount[r.nurse_id]||0});
    });

    const print = (arr, label) => {
      console.log(`\n${label} (${arr.length}):`);
      arr.slice(0, 15).forEach(({r,n,shifts}) => {
        console.log('  - ' + (n?.name||'???').padEnd(44).substring(0,44) + ' | role=' + String(n?.role||'-').padEnd(16) + ' vinc=' + String(n?.vinculo||'-').padEnd(14) + ' | shifts=' + String(shifts).padStart(3) + (r.name_star?' *':'') + ' sector=' + (r.sector||'-'));
      });
      if (arr.length > 15) console.log('  ... +' + (arr.length-15));
    };
    print(enfermeiros, '>>> ENFERMEIROS (SUPERIOR)');
    print(tecnicos, 'TECNICOS/AUXILIARES');
    print(medicos, 'MEDICOS');
    print(outros, 'OUTROS');
  }

  // Identifica enfermeiros que tinham em JULHO mas nao tem em AGOSTO
  console.log('\n========== DIFERENCIAL: ENFERMEIROS DE JULHO QUE SUMIRAM EM AGOSTO ==========');
  const getEnfIds = async (monthNum) => {
    const {data: ros} = await sb.from('monthly_rosters').select('nurse_id').eq('unit_id', posto1.id).eq('month', monthNum).eq('year', 2026);
    const ids = (ros||[]).map(r => r.nurse_id);
    if (!ids.length) return [];
    const {data: nurses} = await sb.from('nurses').select('id, name, role, vinculo, coren').in('id', ids);
    return (nurses||[]).filter(n => {
      const rl = (n.role||'').toLowerCase();
      const vl = (n.vinculo||'').toLowerCase();
      return (rl.includes('enfermeir') && !rl.includes('tecnic') && !rl.includes('auxiliar')) || (vl.includes('enfermeir') && !vl.includes('tecnic') && !vl.includes('auxiliar'));
    });
  };
  const julEnf = await getEnfIds(7);
  const agoEnf = await getEnfIds(8);
  const agoIds = new Set(agoEnf.map(e => e.id));
  console.log('Enfermeiros no POSTO 1 em JULHO:', julEnf.length);
  console.log('Enfermeiros no POSTO 1 em AGOSTO:', agoEnf.length);
  const sumiram = julEnf.filter(e => !agoIds.has(e.id));
  console.log('\nEnfermeiros que ESTAVAM em Julho e SUMIRAM em Agosto (POSTO 1):', sumiram.length);
  sumiram.forEach(n => {
    console.log('  - ' + n.name.padEnd(44).substring(0,44) + ' | role=' + String(n.role||'-').padEnd(16) + ' vinc=' + String(n.vinculo||'-').padEnd(14) + ' coren=' + (n.coren||'-'));
  });

  // Verifica: esses sumiram foram movidos pra outra unidade em agosto?
  console.log('\n========== FORAM MOVIDOS PARA OUTRA UNIDADE EM AGOSTO? ==========');
  const sumiramIds = sumiram.map(n => n.id);
  if (sumiramIds.length) {
    const {data: agoAny} = await sb.from('monthly_rosters').select('nurse_id, unit_id, sector').in('nurse_id', sumiramIds).eq('month', 8).eq('year', 2026);
    const unitMap = Object.fromEntries(units.map(u=>[u.id,u.title]));
    (agoAny||[]).forEach(r => {
      const n = sumiram.find(x => x.id === r.nurse_id);
      console.log('  - ' + (n?.name||'???').padEnd(40).substring(0,40) + ' >> movido p/ unidade: ' + (unitMap[r.unit_id]||r.unit_id));
    });
    const moveramIds = new Set((agoAny||[]).map(r=>r.nurse_id));
    const verdadeiramenteSumiram = sumiram.filter(n => !moveramIds.has(n.id));
    console.log('\nVerdadeiramente SUMIDOS (nem em outra unidade em agosto):', verdadeiramenteSumiram.length);
    verdadeiramenteSumiram.forEach(n => console.log('  - [SEM ROSTER NENHUM AGOSTO] ' + n.name));
  }
})();
