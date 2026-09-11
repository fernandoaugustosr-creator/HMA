require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: units } = await sb.from('units').select('id, title');
  const posto1 = units.find(u => (u.title||'').toUpperCase().includes('POSTO 1') &&
    !(u.title||'').toUpperCase().includes('TRAUMA') && !(u.title||'').toUpperCase().includes('POSTO 2'));
  if (!posto1) { console.log('POSTO 1 nao encontrado'); return; }
  const pid = posto1.id;
  console.log('>>> POSTO 1 (id=' + pid.substring(0,8) + '...) - COMPARATIVO JULHO x AGOSTO 2026\n');

  // Sections
  const { data: sections } = await sb.from('sections').select('id, name, unit_id, order_index');
  const smap = Object.fromEntries((sections||[]).map(s => [s.id, s]));

  for (const [mes, mnum] of [['JULHO', 7], ['AGOSTO', 8]]) {
    console.log('\n========== ' + mes + ' 2026: TODAS AS SECOES DO POSTO 1 ==========');

    // Roster completo do Posto 1
    const { data: ros } = await sb
      .from('monthly_rosters')
      .select('id, nurse_id, section_id, sector, list_order')
      .eq('unit_id', pid).eq('month', mnum).eq('year', 2026);

    const nurseIds = (ros||[]).map(r => r.nurse_id);
    const { data: ns } = await sb.from('nurses').select('id, name, role, vinculo, coren').in('id', nurseIds.length ? nurseIds : ['00000000-0000-0000-0000-000000000000']);
    const nmap = Object.fromEntries((ns||[]).map(n => [n.id, n]));

    // Conta enfermeiros por section
    const bySec = {};
    const total = { tec: 0, enf: 0, med: 0, out: 0 };
    (ros||[]).forEach(r => {
      const sid = r.section_id || 'SEM_SECTION';
      if (!bySec[sid]) bySec[sid] = { tec: 0, enf: 0, med: 0, out: 0, nomes: [], section: smap[sid] };
      const n = nmap[r.nurse_id];
      const rl = (n?.role||'').toUpperCase();
      let cat = 'out';
      if (rl === 'ENFERMEIRO') cat = 'enf';
      else if (rl === 'TECNICO' || rl === 'AUXILIAR') cat = 'tec';
      else if (rl === 'MEDICO' || (n?.crm)) cat = 'med';
      bySec[sid][cat]++;
      total[cat]++;
      if (cat === 'enf') bySec[sid].nomes.push(n?.name || '???');
    });

    console.log('Total geral Posto 1 ' + mes + ': Tec/Aux=' + total.tec + ', ENF=' + total.enf + ', Med=' + total.med + ', Outros=' + total.out);
    console.log('');
    const secs = Object.entries(bySec).sort((a,b) => (a[1].section?.order_index||0) - (b[1].section?.order_index||0));
    secs.forEach(([sid, info]) => {
      const sname = info.section ? info.section.name : '<<SECTION REMOVIDA/NAO EXISTE>> (' + sid.substring(0,8) + '..)';
      console.log('  [Bloco/Section] ' + sname + ':');
      console.log('     Tec=' + info.tec + ' | ENF=' + info.enf + ' | Med=' + info.med + ' | Outros=' + info.out);
      if (info.nomes.length) {
        console.log('     >>> Enfermeiros neste bloco (' + info.nomes.length + '):');
        info.nomes.forEach(nm => console.log('       - ' + nm));
      }
    });
  }

  // Agora busca TODOS enfermeiros (qualquer unidade) que estavam em JULHO no Posto 1
  // e verifica onde estao em AGOSTO
  console.log('\n========== RASTREAMENTO DOS ENFERMEIROS: DO POSTO 1 JULHO -> AGOSTO ==========');
  const { data: rosJul } = await sb
    .from('monthly_rosters')
    .select('nurse_id, section_id')
    .eq('unit_id', pid).eq('month', 7).eq('year', 2026);
  const nidsJul = (rosJul||[]).map(r=>r.nurse_id);
  const { data: nsJul } = await sb.from('nurses').select('id, name, role, vinculo').in('id', nidsJul.length ? nidsJul : ['00000000-0000-0000-0000-000000000000']);
  const enfermeirosJulPosto1 = (nsJul||[]).filter(n => (n.role||'').toUpperCase() === 'ENFERMEIRO');
  console.log('Enfermeiros que estavam no POSTO 1 em JULHO:', enfermeirosJulPosto1.length);
  if (enfermeirosJulPosto1.length === 0) {
    console.log('  (!) Nenhum encontrado com role=ENFERMEIRO. Procurando por ENFERMEIRO(a) ou categoria ENF. mesmo em vinculo...');
  }

  const { data: rosAgo } = await sb
    .from('monthly_rosters')
    .select('nurse_id, unit_id, section_id')
    .eq('month', 8).eq('year', 2026);
  const agoByNurse = Object.fromEntries((rosAgo||[]).map(r => [r.nurse_id, r]));

  const umap = Object.fromEntries(units.map(u=>[u.id,u.title]));
  enfermeirosJulPosto1.forEach(n => {
    const ago = agoByNurse[n.id];
    const julSec = smap[(rosJul||[]).find(r=>r.nurse_id===n.id)?.section_id]?.name || '-';
    if (ago) {
      console.log('  - ' + n.name.padEnd(40).substring(0,40) + ' | JUL: Posto1 [' + julSec + ']  >>  AGOSTO: [' + (umap[ago.unit_id]||'??').substring(0,35).padEnd(35) + '] sec=' + (smap[ago.section_id]?.name || '-').substring(0,30));
    } else {
      console.log('  *** SUMIU: ' + n.name.padEnd(40).substring(0,40) + ' | JUL: Posto1 [' + julSec + ']  >>  AGOSTO: SEM ROSTER NENHUM!');
    }
  });

  // Se nao achou os 6 por role, tenta por outros criterios (Enfermeiro no nome do vinculo ou section)
  if (enfermeirosJulPosto1.length < 6) {
    console.log('\n>>> Buscando tambem por ENF. na nomenclatura de section ou outras pistas:');
    const { data: all } = await sb.from('nurses').select('id,name,role,vinculo').limit(10);
  }
})();
