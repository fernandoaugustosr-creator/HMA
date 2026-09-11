require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== ENFERMEIROS (qualquer variacao de role) cadastrados ===\n');

  // Todos nurses que sao enfermeiros por qualquer criterio
  const { data: allNurses, error } = await sb.from('nurses').select('id,name,role,vinculo,coren,crm');
  if (error) { console.log('ERRO:', error.message); return; }

  function isEnfermeiro(n) {
    if (!n) return false;
    const r = String(n.role||'').toLowerCase();
    const v = String(n.vinculo||'').toLowerCase();
    if (n.crm) return false;
    const contemEnf = r.includes('enfermeir') || v.includes('enfermeir');
    const contemTec = r.includes('tecnic') || r.includes('auxiliar') || v.includes('tecnic') || v.includes('auxiliar');
    return contemEnf && !contemTec;
  }

  const todosEnf = (allNurses||[]).filter(isEnfermeiro);
  console.log('Total enfermeiros (qualquer variacao, sem tecnico/aux):', todosEnf.length);
  // Lista roles distintos encontrados
  const rolesUnicos = {};
  todosEnf.forEach(n => {
    const k = (n.role||'-vazio-') + ' | ' + (n.vinculo||'-vazio-');
    rolesUnicos[k] = (rolesUnicos[k]||0)+1;
  });
  console.log('Combinacoes (role | vinculo) e suas contagens:');
  Object.entries(rolesUnicos).sort((a,b)=>b[1]-a[1]).slice(0, 10).forEach(([k,c]) => console.log('  (' + c + ') ' + k));

  // Agora, alocacoes por unidade em julho e agosto
  const { data: units } = await sb.from('units').select('id, title');
  const umap = Object.fromEntries(units.map(u=>[u.id,u.title]));

  for (const [mes, mnum] of [['JULHO', 7], ['AGOSTO', 8]]) {
    // Pega TODOS os rosters do mes
    let ros = [];
    let from = 0;
    while (true) {
      const { data, error } = await sb.from('monthly_rosters')
        .select('id,nurse_id,unit_id,section_id,list_order')
        .eq('month', mnum).eq('year', 2026)
        .range(from, from+999);
      if (error) break;
      ros = ros.concat(data||[]);
      if ((data||[]).length < 1000) break;
      from += 1000;
    }

    // Pega os nurses que estao nesses rosters e sao enfermeiros
    const nurseIds = Array.from(new Set(ros.map(r=>r.nurse_id)));
    const { data: ns } = await sb.from('nurses').select('id,name,role,vinculo,coren').in('id', nurseIds);
    const nmap = Object.fromEntries((ns||[]).map(n=>[n.id,n]));

    const byUnit = {};
    const enfermeirosLista = [];
    ros.forEach(r => {
      const n = nmap[r.nurse_id];
      if (isEnfermeiro(n)) {
        const uid = r.unit_id || 'NULO';
        if (!byUnit[uid]) byUnit[uid] = { count: 0, nomes: [] };
        byUnit[uid].count++;
        const label = (n.name) + ' [role=' + (n.role||'-') + ', vinc=' + (n.vinculo||'-') + ']';
        if (!byUnit[uid].nomes.includes(label)) byUnit[uid].nomes.push(label);
        enfermeirosLista.push({n, r});
      }
    });

    console.log('\n>>> ' + mes + ' 2026: ' + enfermeirosLista.length + ' enfermeiros alocados no total.');
    console.log('>>> Distribuidos por unidade:');
    const ordenado = Object.entries(byUnit).map(([uid, info]) => ({
      nome: uid === 'NULO' ? '<<SEMACAO>>' : (umap[uid] || '???'),
      count: info.count,
      nomes: info.nomes
    })).sort((a,b)=>b.count-a.count);
    ordenado.filter(l => l.count>0).forEach(l => {
      console.log('  [' + String(l.nome).padEnd(45).substring(0,45) + '] ' + String(l.count).padStart(2) + ' enfermeiros');
      l.nomes.slice(0, 12).forEach(nm => console.log('     - ' + nm));
      if (l.nomes.length > 12) console.log('     ... +' + (l.nomes.length-12));
    });
  }

  // Lista dos enfermeiros que estao em julho em alguma unidade com >= 3
  // e verifica onde estao em agosto
  console.log('\n========== RASTREAMENTO INDIVIDUAL: ENFERMEIROS ALOCADOS EM JULHO ==========\n');
  const pegaRostersMes = async (mnum) => {
    const { data: ros } = await sb.from('monthly_rosters').select('nurse_id,unit_id').eq('month', mnum).eq('year', 2026);
    const ids = Array.from(new Set((ros||[]).map(r=>r.nurse_id)));
    const { data: ns } = await sb.from('nurses').select('id,name,role,vinculo').in('id', ids.length?ids:['00000000-0000-0000-0000-000000000000']);
    const nmap = Object.fromEntries((ns||[]).map(n=>[n.id,n]));
    return (ros||[]).filter(r => isEnfermeiro(nmap[r.nurse_id])).map(r => ({nurse_id: r.nurse_id, unit_id: r.unit_id, name: nmap[r.nurse_id].name, role: nmap[r.nurse_id].role, vinc: nmap[r.nurse_id].vinculo}));
  };

  const julEnf = await pegaRostersMes(7);
  const agoEnf = await pegaRostersMes(8);
  const agoMap = {};
  agoEnf.forEach(e => { agoMap[e.nurse_id] = e; });

  console.log('Total enfermeiros alocados em JULHO:', julEnf.length);
  console.log('Total enfermeiros alocados em AGOSTO:', agoEnf.length);
  console.log('');

  const agrupadosJul = {};
  julEnf.forEach(e => { const u = e.unit_id || 'NULO'; if (!agrupadosJul[u]) agrupadosJul[u] = []; agrupadosJul[u].push(e); });

  Object.entries(agrupadosJul).forEach(([uid, arr]) => {
    if (arr.length >= 2) {
      const uname = uid === 'NULO' ? '<< SEM ACAO >>' : (umap[uid] || '???');
      console.log('>>> Unidade [' + uname + '] em JULHO tinha ' + arr.length + ' enfermeiros:');
      arr.forEach(e => {
        const a = agoMap[e.nurse_id];
        if (a) {
          console.log('  |- ' + e.name.padEnd(40).substring(0,40) + ' | AGOSTO: está em [' + (a.unit_id ? (umap[a.unit_id]||'???').substring(0,35) : 'SEM UNIDADE').padEnd(35) + ']');
        } else {
          console.log('  xX ' + e.name.padEnd(40).substring(0,40) + ' | AGOSTO: SUMIU (sem nenhum roster)!!!');
        }
      });
      console.log('');
    }
  });
})();
