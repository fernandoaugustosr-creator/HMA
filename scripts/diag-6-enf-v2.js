require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: units } = await sb.from('units').select('id, title');
  const umap = Object.fromEntries(units.map(u=>[u.id,u.title]));

  function isEnfermeiro(n) {
    if (!n) return false;
    const r = String(n.role||'').toLowerCase();
    const v = String(n.vinculo||'').toLowerCase();
    if (n.crm && n.crm.trim()) return false;
    const temEnf = r.includes('enfermeir') || v.includes('enfermeir');
    const temTec = r.includes('tecnic') || r.includes('auxiliar') || v.includes('tecnic') || v.includes('auxiliar');
    return temEnf && !temTec;
  }

  // Comparativo JULHO vs AGOSTO por unidade
  for (const [mes, mnum] of [['JULHO', 7], ['AGOSTO', 8]]) {
    const { data: ros, error } = await sb
      .from('monthly_rosters')
      .select('nurse_id, unit_id, id, created_at')
      .eq('month', mnum).eq('year', 2026);
    console.log('\n>>> ' + mes + ': total rosters =', (ros||[]).length, error? 'ERRO:'+error.message : '');
    if (!ros || ros.length === 0) continue;

    const nurseIds = Array.from(new Set(ros.map(r=>r.nurse_id)));
    const { data: ns } = await sb.from('nurses').select('id,name,role,vinculo,coren,crm').in('id', nurseIds);
    const nmap = Object.fromEntries((ns||[]).map(n=>[n.id,n]));

    const byUnit = {};
    let totalEnf = 0;
    ros.forEach(r => {
      const n = nmap[r.nurse_id];
      const eh = isEnfermeiro(n);
      if (eh) {
        totalEnf++;
        const uid = r.unit_id || 'NULO';
        if (!byUnit[uid]) byUnit[uid] = { count: 0, nomes: new Set(), exemplos: [] };
        byUnit[uid].count++;
        byUnit[uid].nomes.add(n.name);
        if (byUnit[uid].exemplos.length < 8) byUnit[uid].exemplos.push({name: n.name, role: n.role, vinc: n.vinculo});
      }
    });
    console.log('Total enfermeiros alocados em ' + mes + ':', totalEnf);
    const lines = Object.entries(byUnit).map(([uid,x]) => ({nome: uid==='NULO'?'SEM UNIDADE':umap[uid]||'???', uid, count:x.count, nomes: [...x.nomes], exemplos: x.exemplos})).sort((a,b)=>b.count-a.count);
    lines.filter(l=>l.count>0).forEach(l => {
      console.log('  [' + String(l.nome).padEnd(45).substring(0,45) + '] ' + String(l.count).padStart(2) + ' enfermeiros  (ids distintos=' + l.nomes.length + ')');
      l.exemplos.forEach(e => console.log('     - ' + String(e.name).padEnd(38).substring(0,38) + ' | role=' + String(e.role||'-').padEnd(14) + ' vinc=' + e.vinc));
    });
  }

  // Diagnostico especifico: mostra registros nurses (Joselia e outros)
  console.log('\n========== AMOSTRA 10 ENFERMEIROS CADASTRADOS: ==========');
  const { data: todosEnf } = await sb.from('nurses').select('id,name,role,vinculo,coren,unit_id').order('name').limit(10);
  (todosEnf||[]).forEach(n => {
    console.log('  id=' + n.id.substring(0,8) + '...  ' + String(n.name).padEnd(38).substring(0,38) + ' | role=' + String(n.role||'-').padEnd(14) + ' vinc=' + String(n.vinculo||'-').padEnd(12));
  });
})();
