require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== UNIDADES COM MAIS ENFERMEIROS (role=ENFERMEIRO) em JULHO 2026 ===\n');

  const { data: units } = await sb.from('units').select('id, title');
  const umap = Object.fromEntries(units.map(u=>[u.id,u.title]));

  for (const [mes, mnum] of [['JULHO', 7], ['AGOSTO', 8]]) {
    // Pega todos rosters e nurses do mes
    const { data: ros } = await sb
      .from('monthly_rosters')
      .select('nurse_id, unit_id, section_id')
      .eq('month', mnum).eq('year', 2026);
    const ids = Array.from(new Set((ros||[]).map(r=>r.nurse_id)));
    const { data: ns } = await sb.from('nurses').select('id,name,role,vinculo').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const nmap = Object.fromEntries((ns||[]).map(n=>[n.id,n]));

    const byUnit = {};
    (ros||[]).forEach(r => {
      const uid = r.unit_id || 'NULL';
      if (!byUnit[uid]) byUnit[uid] = { tec: 0, enf: 0, med: 0, out: 0, enfermeirosNomes: [] };
      const n = nmap[r.nurse_id];
      const rl = (n?.role||'').toUpperCase();
      let c = 'out';
      if (rl === 'ENFERMEIRO') c = 'enf';
      else if (rl === 'TECNICO' || rl === 'AUXILIAR') c = 'tec';
      else if (rl === 'MEDICO' || (n?.crm)) c = 'med';
      byUnit[uid][c]++;
      if (c === 'enf' && !byUnit[uid].enfermeirosNomes.includes(n?.name)) byUnit[uid].enfermeirosNomes.push(n?.name);
    });

    console.log('\n--- ' + mes + ' 2026 (unidades ordenadas por qtd ENFERMEIROS) ---');
    const lines = Object.entries(byUnit).map(([uid, info]) => {
      const nome = uid === 'NULL' ? '(sem unidade)' : umap[uid] || '???';
      return { nome, ...info, uid };
    }).sort((a,b)=>b.enf-a.enf);
    lines.filter(l => l.enf >= 1 || l.nome.toLowerCase().includes('enferm') || l.nome.toLowerCase().includes('utienf') || l.nome.toLowerCase().includes('pronto socorro')).forEach(l => {
      const nomes = l.enfermeirosNomes.slice(0, 10).map(n => (n||'').substring(0,32).padEnd(32)).join(' ; ');
      console.log('  ENF=' + String(l.enf).padStart(2) + ' Tec=' + String(l.tec).padStart(3) + ' Med=' + String(l.med).padStart(2) +
        ' | ' + String(l.nome).padEnd(45).substring(0,45) + (l.enf > 0 ? ('\n      >>> ' + nomes + (l.enfermeirosNomes.length>10?(' ...+'+(l.enfermeirosNomes.length-10)):'')) : ''));
    });
  }

  // Diferencial: Unidades que tinham >=3 enfermeiros em JULHO e perderam em AGOSTO
  console.log('\n========== DIFERENCIAL: UNIDADES QUE PERDERAM ENFERMEIROS NO AGOSTO ==========');
  const dados = {};
  for (const [mes, mnum] of [['jul', 7], ['ago', 8]]) {
    const { data: ros } = await sb.from('monthly_rosters').select('nurse_id, unit_id').eq('month', mnum).eq('year', 2026);
    const ids = Array.from(new Set((ros||[]).map(r=>r.nurse_id)));
    const { data: ns } = await sb.from('nurses').select('id,name,role').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const nmap = Object.fromEntries((ns||[]).map(n=>[n.id,n]));
    const byU = {};
    (ros||[]).forEach(r => {
      const u = r.unit_id || 'NULL';
      if (!byU[u]) byU[u] = { count: 0, nomes: [] };
      if ((nmap[r.nurse_id]?.role||'').toUpperCase() === 'ENFERMEIRO') {
        byU[u].count++;
        if (!byU[u].nomes.includes(nmap[r.nurse_id]?.name)) byU[u].nomes.push(nmap[r.nurse_id]?.name);
      }
    });
    dados[mes] = byU;
  }
  const allUnits = new Set([...Object.keys(dados.jul||{}), ...Object.keys(dados.ago||{})]);
  allUnits.forEach(uid => {
    const j = dados.jul[uid] || { count: 0, nomes: [] };
    const a = dados.ago[uid] || { count: 0, nomes: [] };
    if (j.count >= 1 && a.count < j.count) {
      const nome = uid === 'NULL' ? '(sem unidade)' : umap[uid] || '???';
      console.log('  [' + String(nome).padEnd(45).substring(0,45) + '] JUL=' + j.count + ' enfermeiros  >>  AGO=' + a.count + ' enfermeiros  (dif: -' + (j.count-a.count) + ')');
      if (j.count >= 3) {
        console.log('      >>> Em Julho estavam:');
        j.nomes.forEach(nm => console.log('         - ' + nm));
      }
    }
  });
})();
