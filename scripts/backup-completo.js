require('dotenv').config({path: '.env.local'});
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function dumpAll(table, filterFn = null) {
  let from = 0, all = [];
  while (true) {
    const { data, error } = await sb.from(table).select('*').range(from, from+999).order('id');
    if (error) { console.log('ERRO '+table+':', error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return filterFn ? all.filter(filterFn) : all;
}

(async () => {
  const ts = new Date().toISOString().replace(/[T:\.\-]/g,'_').slice(0,19);
  const dir = path.join(__dirname, '..', 'backup', 'backup_'+ts);
  fs.mkdirSync(dir, { recursive: true });
  console.log('BACKUP em:', dir);

  const tables = [
    'units', 'nurses', 'sections',
    'monthly_rosters', 'monthly_schedule_metadata', 'roster_requests',
    'vacation_periods', 'health_leave_periods', 'maternity_leave_periods',
    'cessions', 'permuta'
  ];

  for (const t of tables) {
    const data = await dumpAll(t);
    const f = path.join(dir, t + '.json');
    fs.writeFileSync(f, JSON.stringify(data, null, 2));
    console.log('  [OK] ' + t + ' => ' + data.length + ' linhas (' + f + ')');
  }

  // Shifts: pega 2025 e 2026 (limita por ano para não estourar paginacao)
  let totalShifts = 0;
  for (const ano of [2025, 2026]) {
    let from = 0, dataAno = [];
    while (true) {
      const { data, error } = await sb.from('shifts').select('*')
        .gte('date', ano+'-01-01').lte('date', ano+'-12-31')
        .order('date').range(from, from+999);
      if (error) break;
      if (!data || data.length === 0) break;
      dataAno = dataAno.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }
    fs.writeFileSync(path.join(dir, 'shifts_'+ano+'.json'), JSON.stringify(dataAno, null, 2));
    console.log('  [OK] shifts_' + ano + ' => ' + dataAno.length + ' linhas');
    totalShifts += dataAno.length;
  }

  console.log('\nBackup CONCLUÍDO.');
  console.log('Arquivos em: ' + dir);
  console.log('Total shifts (2025+2026):', totalShifts);
  console.log('\nIMPORTANTE: guarde esse diretório de backup localmente (pasta backup\\backup_*). Nenhuma alteração foi feita, só leitura.');
})();
