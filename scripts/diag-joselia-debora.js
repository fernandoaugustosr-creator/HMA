require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== INVESTIGACAO: Joselia / Debora - REGISTROS NO BANCO ===\n');

  // Procura Joselia e Debora na tabela nurses
  const nomes = ['JOSELIA DE FATIMA ATAYDES', 'DEBORA MARIA OLIVEIRA DA SILVA', 'MARIA LEDA DIAS DOS SANTOS SOUZA', 'ALZIENEIDE VIANA DA SILVA'];
  for (const nome of nomes) {
    const { data: nurses } = await sb.from('nurses').select('id, name, role, vinculo, coren, crm, unit_id').ilike('name', '%' + nome.split(' ')[0] + '%' + nome.split(' ').slice(-1)[0] + '%');
    console.log('\n>>> Busca por:', nome);
    (nurses||[]).forEach(n => {
      console.log('  id=' + n.id.substring(0,8) + '... | name=' + n.name + ' | role=' + String(n.role||'-').padEnd(14) + ' vinc=' + String(n.vinculo||'-').padEnd(18) + ' coren=' + (n.coren||'-'));
    });
  }

  // Agora verifica em quais unidades/meses esses IDs aparecem no roster
  console.log('\n=== ROSTER MENSAL (JUL vs AGO) para Joselia/ Debora ===');
  const allN = [];
  for (const nome of nomes.slice(0,2)) {
    const { data: nurses } = await sb.from('nurses').select('id, name').ilike('name', '%' + nome.split(' ')[0] + '%' + nome.split(' ').slice(-1)[0] + '%');
    allN.push(...(nurses||[]));
  }
  if (allN.length) {
    const ids = allN.map(n => n.id);
    const {data: units} = await sb.from('units').select('id, title');
    const umap = Object.fromEntries(units.map(u=>[u.id,u.title]));
    const {data: ros} = await sb.from('monthly_rosters').select('nurse_id, unit_id, month, year, vinculo, sector, created_at, observation, id').in('nurse_id', ids).gte('month',7).lte('month',8).eq('year',2026);
    const nmap = Object.fromEntries(allN.map(n=>[n.id,n.name]));
    (ros||[]).forEach(r => {
      console.log('  ' + nmap[r.nurse_id].padEnd(35).substring(0,35) + ' | ' + (r.year+'/'+String(r.month).padStart(2,'0')) + ' | Unit: ' + (umap[r.unit_id]||'??').substring(0,35).padEnd(35) + ' | sector=' + String(r.sector||'-').padEnd(12) + ' obs=' + (r.observation||'-'));
    });
  }

  // Conta enfermeiros(role=ENFERMEIRO) alocados em cada unidade vs nao alocados
  console.log('\n=== DISTRIBUICAO ENFERMEIROS POR UNIDADE (AGOSTO) ===');
  const { data: todosEnf } = await sb.from('nurses').select('id, name, role, vinculo').eq('role', 'ENFERMEIRO');
  console.log('Total nurses com role=ENFERMEIRO no banco:', (todosEnf||[]).length);
  const idsEnf = (todosEnf||[]).map(n=>n.id);
  if (idsEnf.length) {
    const {data: ros2} = await sb.from('monthly_rosters').select('nurse_id, unit_id').in('nurse_id', idsEnf).eq('month',8).eq('year',2026);
    const {data: units2} = await sb.from('units').select('id, title');
    const umap2 = Object.fromEntries(units2.map(u=>[u.id,u.title]));
    const cnt = {};
    (ros2||[]).forEach(r => { cnt[r.unit_id] = (cnt[r.unit_id]||0)+1; });
    Object.entries(cnt).sort((a,b)=>b[1]-a[1]).forEach(([uid,c]) => {
      console.log('  - ' + String(umap2[uid]||uid).padEnd(45).substring(0,45) + ' : ' + c + ' enfermeiros alocados');
    });
    const alocados = new Set((ros2||[]).map(r=>r.nurse_id));
    console.log('  >> Enfermeiros (role=ENFERMEIRO) SEM NENHUM ROSTER AGOSTO:', idsEnf.filter(id=>!alocados.has(id)).length);
  }

  // O usuario mostrou CATEGORIA = ENFERMEIRO(A) para Debora SEL na foto Julho,
  // mas banco mostra role=TECNICO. Sera que ha um outro ID para Debora ENFERMEIRO?
  console.log('\n=== TODOS os registros de DEBORA MARIA OLIVEIRA DA SILVA no nurses ===');
  const {data: deb} = await sb.from('nurses').select('id, name, role, vinculo, coren, crm').ilike('name', '%DEBORA%OLIVEIRA%');
  (deb||[]).forEach(n => console.log('  ', JSON.stringify(n)));
})();
