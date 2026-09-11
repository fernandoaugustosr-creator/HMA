require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== DIAGNOSTICO: shifts de agosto estao orfaos (sem roster_id)? ===\n');

  // Conta shifts agosto por estado de roster_id
  let total = 0, comRoster = 0, semRoster = 0;
  const porTipo = {};
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('shifts')
      .select('id, roster_id, nurse_id, date, type')
      .gte('date','2026-08-01').lte('date','2026-08-31')
      .range(from, from+999);
    if (error || !data || data.length === 0) break;
    total += data.length;
    data.forEach(s => {
      if (s.roster_id) comRoster++; else semRoster++;
      porTipo[s.type||'-'] = (porTipo[s.type||'-']||0)+1;
    });
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Total shifts AGOSTO 2026:', total);
  console.log('  COM roster_id.......:', comRoster);
  console.log('  SEM roster_id (orfaos):', semRoster);
  console.log('  Tipos:', porTipo);

  // Mesma coisa para julho para comparar
  console.log('\n--- JULHO 2026 (mesma consulta) ---');
  let totalJ=0, comJ=0, semJ=0;
  from=0;
  while (true) {
    const { data, error } = await sb
      .from('shifts')
      .select('roster_id')
      .gte('date','2026-07-01').lte('date','2026-07-31')
      .range(from, from+999);
    if (error || !data || data.length === 0) break;
    totalJ += data.length;
    data.forEach(s => s.roster_id ? comJ++ : semJ++);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Total julho:', totalJ, 'com_roster:', comJ, 'sem_roster:', semJ);

  // E junho? (tinha 6 enfermeiros em UTI ENF e NIR)
  console.log('\n--- JUNHO 2026 (mesma consulta) ---');
  let totalJun=0, comJun=0, semJun=0;
  from=0;
  while (true) {
    const { data, error } = await sb
      .from('shifts')
      .select('roster_id')
      .gte('date','2026-06-01').lte('date','2026-06-31')
      .range(from, from+999);
    if (error || !data || data.length === 0) break;
    totalJun += data.length;
    data.forEach(s => s.roster_id ? comJun++ : semJun++);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Total junho:', totalJun, 'com_roster:', comJun, 'sem_roster:', semJun);

  // Posto 1 em agosto: confirma no banco os rost + alguns shifts orfaos
  const { data: units } = await sb.from('units').select('id,title');
  const posto1 = units.find(u => (u.title||'').toUpperCase().includes('POSTO 1') &&
    !(u.title||'').toUpperCase().includes('TRAUMA') && !(u.title||'').toUpperCase().includes('POSTO 2'));
  if (posto1) {
    console.log('\n=== POSTO 1 AGOSTO: rosters + shifts orfaos de seus nurses ===');
    const { data: ros } = await sb.from('monthly_rosters').select('id, nurse_id, list_order')
      .eq('unit_id', posto1.id).eq('month',8).eq('year',2026).order('list_order').limit(5);
    const nurseIds = ros.map(r => r.nurse_id);
    console.log('Amostra primeiros 5 rosters (agosto, Posto 1):', ros.map(r=>({rostId:r.id.substring(0,8), nurseId:r.nurse_id.substring(0,8)})));
    if (nurseIds.length) {
      const {data: shEx} = await sb.from('shifts').select('id, roster_id, nurse_id, date, type')
        .in('nurse_id', nurseIds).gte('date','2026-08-01').lte('date','2026-08-05').limit(10);
      console.log('Shifts das mesmas enfermeiras entre 01-05/ago:');
      (shEx||[]).forEach(s => console.log('  nurse=' + s.nurse_id.substring(0,8) + '... rost=' + (s.roster_id? (s.roster_id.substring(0,8)+'...') : 'NULO (orfao)') + ' ' + s.date + ' ' + s.type));
    }
  }

  // Verifica se nurses de PRONTO SOCORRO ENFERMEIRO / UTI ENF em junho tem shifts em julho/agosto
  console.log('\n=== UTI ENFERMEIROS: enfermeiros que tinham em junho e seus shifts hoje ===');
  const utiEnf = units.find(u => /UTI.*ENFERM/i.test(u.title));
  if (utiEnf) {
    const { data: rosJun } = await sb.from('monthly_rosters').select('nurse_id').eq('unit_id',utiEnf.id).eq('month',6).eq('year',2026);
    const ids = (rosJun||[]).map(r=>r.nurse_id);
    console.log('Enfermeiros alocados na UTI ENF em JUNHO:', ids.length);
    const { data: ns } = await sb.from('nurses').select('id,name,role,vinculo').in('id', ids.length? ids : ['00000000-0000-0000-0000-000000000000']);
    (ns||[]).forEach(n => {
      // Shifts nos meses
      const meses = {};
      (async ()=>{})();
    });
    // Para cada mes, conta se tem shifts (mesmo orfaos) via nurse_id + data
    for (const [mesLabel, mesNum, mesStr] of [['Junho',6,'06'],['Julho',7,'07'],['Agosto',8,'08']]) {
      const dateFrom = '2026-'+mesStr+'-01';
      const dateTo   = '2026-'+mesStr+'-31';
      const { count } = await sb.from('shifts').select('*',{count:'exact',head:true})
        .in('nurse_id', ids.length? ids : ['00000000-0000-0000-0000-000000000000'])
        .gte('date',dateFrom).lte('date',dateTo);
      // Roster no mes
      const { count: rosCount } = await sb.from('monthly_rosters').select('*',{count:'exact',head:true})
        .in('nurse_id', ids.length? ids : ['00000000-0000-0000-0000-000000000000'])
        .eq('month',mesNum).eq('year',2026);
      console.log('  ' + mesLabel + ': Shifts por nurse_id=' + count + ' | Rosters no mês=' + rosCount);
    }
    console.log('  Lista enfermeiros (UTI ENF - junho):');
    (ns||[]).forEach(n => console.log('    - ' + n.name.padEnd(40).substring(0,40) + ' | role=' + n.role + ' vinc=' + n.vinculo));
  }
})();
