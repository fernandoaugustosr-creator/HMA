require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: units } = await sb.from('units').select('id, title');
  const posto1 = units.find(u => (u.title||'').toUpperCase().includes('POSTO 1') &&
    !(u.title||'').toUpperCase().includes('TRAUMA') && !(u.title||'').toUpperCase().includes('POSTO 2'));

  // 1) Pega rost + nurses direto do POSTO 1 em agosto
  const { data: rost } = await sb
    .from('monthly_rosters')
    .select('id, nurse_id, list_order')
    .eq('unit_id', posto1.id).eq('month', 8).eq('year', 2026)
    .order('list_order');
  const nids = Array.from(new Set(rost.map(r=>r.nurse_id)));

  console.log('=== POSTO 1 AGOSTO: rosters=', rost.length, ', nurses distintos=', nids.length);
  const { data: ns } = await sb.from('nurses').select('id,name,role,vinculo,coren,crm').in('id', nids);
  console.log('nurses retornados pelo in():', ns.length, '(se for menor que', nids.length, 'e problema de limite!)');

  // Imprime todos
  rost.forEach((r,i) => {
    const n = ns.find(x => x.id === r.nurse_id);
    const ehEnf = (n && /enfermeir/i.test(n.role||'') && !/tecnic|auxiliar/i.test(n.role||'') && !(n.crm && n.crm.trim()));
    const marc1 = (n && n.role === 'ENFERMEIRO') ? ' <<<<<<<<< ROLE=ENFERMEIRO' : '';
    const marc2 = ehEnf ? ' (FUNCAO isEnfermeiro=TRUE)' : '';
    if (i < 5 || i > rost.length-8 || marc1 || marc2 || /JOSELIA/i.test(n?.name||''))
      console.log(String(i+1).padStart(2) + '  ' + String(n?.name||'???').padEnd(40).substring(0,40) +
        '  role=' + String(n?.role||'-').padEnd(14) + ' vinc=' + String(n?.vinculo||'-').padEnd(14) +
        ' crm="' + String(n?.crm||'') + '"' + marc1 + marc2);
  });

  // 2) Faz a mesma coisa mas para TODAS unidades julho, em lotes de 100, para nao dar problema no in()
  console.log('\n\n========== TODAS UNIDADES JULHO 2026 (lotes de 200 IDs) ==========\n');
  for (const [mes, mnum] of [['JULHO', 7], ['AGOSTO', 8]]) {
    const { data: ros } = await sb.from('monthly_rosters').select('nurse_id, unit_id').eq('month', mnum).eq('year', 2026);
    const todosNurseIds = Array.from(new Set(ros.map(r=>r.nurse_id)));
    console.log(mes + ': rosters=' + ros.length + ', nurseIds unicos=' + todosNurseIds.length);

    // Busca nurses em lotes
    const todosNurses = [];
    const batch = 150;
    for (let i=0; i<todosNurseIds.length; i+=batch) {
      const chunk = todosNurseIds.slice(i, i+batch);
      const { data } = await sb.from('nurses').select('id,name,role,vinculo,coren,crm').in('id', chunk);
      todosNurses.push(...(data||[]));
    }
    const nmap = Object.fromEntries(todosNurses.map(n=>[n.id,n]));
    console.log('   nurses carregados =', todosNurses.length, '(ids procurados=', todosNurseIds.length,')');

    const byUnit = {};
    let cntEnf = 0;
    ros.forEach(r => {
      const n = nmap[r.nurse_id];
      if (!n) return;
      const ehEnf = /enfermeir/i.test(n.role||'') && !/tecnic|auxiliar/i.test(n.role||'') && !(n.crm && n.crm.trim());
      if (ehEnf) {
        cntEnf++;
        const u = r.unit_id || 'NULO';
        if (!byUnit[u]) byUnit[u] = { c:0, nomes: new Set() };
        byUnit[u].c++;
        byUnit[u].nomes.add(n.name);
      }
    });
    console.log('   ENF alocados (todas unidades) em ' + mes + ':', cntEnf);
    const lines = Object.entries(byUnit).map(([uid,x])=>({
      nome: uid==='NULO'?'SEM UNIDADE': units.find(uu=>uu.id===uid)?.title || '???',
      c: x.c, nomes: [...x.nomes]
    })).sort((a,b)=>b.c-a.c);
    lines.filter(l=>l.c>=1).slice(0, 15).forEach(l => {
      console.log('   [' + String(l.nome).padEnd(45).substring(0,45) + '] ' + String(l.c).padStart(3) + ' plantões-alocação de ENF (distintos=' + l.nomes.length + '):');
      l.nomes.slice(0, 10).forEach(nm => console.log('      - ' + nm));
      if (l.nomes.length > 10) console.log('      ... +' + (l.nomes.length-10));
    });
    console.log('');
  }
})();
