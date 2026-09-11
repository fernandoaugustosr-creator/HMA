require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('=== DIAGNOSTICO SUPABASE HMA ===');
  console.log('URL:', url ? url.substring(0, 40) + '...' : 'MISSING');
  console.log('Key:', key ? (key.substring(0, 8) + '...') : 'MISSING');
  console.log('');
  
  if (!url || !key) {
    console.error('CREDENCIAIS FALTANDO no .env.local!');
    process.exit(1);
  }
  
  const supabase = createClient(url, key);
  
  console.log('--- TESTE DE CONEXAO ---');
  try {
    const { data, error } = await supabase
      .from('nurses')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    
    if (error) {
      console.log('CONEXAO FALHOU:', error.message);
      console.log('Detalhes:', JSON.stringify(error));
    } else {
      console.log('CONEXAO OK! Supabase acessivel.');
    }
  } catch (e) {
    console.log('EXCECAO NA CONEXAO:', e.message);
  }
  console.log('');
  
  const tables = ['nurses','monthly_rosters','shifts','monthly_schedule_metadata','absences','time_off_requests','units','schedule_sections','scale_permissions','audit_logs','app_settings'];
  
  console.log('--- CONTAGEM DE REGISTROS ---');
  for (const t of tables) {
    try {
      const { count, error } = await supabase
        .from(t)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`${t}: ERRO - ${error.message}`);
      } else {
        console.log(`${t}: ${count} registros`);
      }
    } catch(e) {
      console.log(`${t}: EXC - ${e.message}`);
    }
  }
  
  console.log('');
  console.log('--- AMOSTRA SHIFTS (ultimos 5) ---');
  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) console.log('Erro:', error.message);
    else if (data && data.length > 0) {
      data.forEach((s,i) => console.log(`  [${i+1}] id=${s.id?.substring(0,8)} nurse=${s.nurse_id?.substring(0,8)} date=${s.date} type=${s.type} roster=${s.roster_id?.substring(0,8)}`));
    } else {
      console.log('  (tabela vazia)');
    }
  } catch(e) { console.log('Excecao:', e.message); }

  console.log('');
  console.log('--- AMOSTRA MONTHLY_ROSTERS (ultimos 5) ---');
  try {
    const { data, error } = await supabase
      .from('monthly_rosters')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) console.log('Erro:', error.message);
    else if (data && data.length > 0) {
      data.forEach((r,i) => console.log(`  [${i+1}] id=${r.id?.substring(0,8)} nurse=${r.nurse_id?.substring(0,8)} m=${r.month}/y=${r.year} unit=${r.unit_id?.substring(0,8)} section=${r.section_id?.substring(0,8)}`));
    } else {
      console.log('  (tabela vazia)');
    }
  } catch(e) { console.log('Excecao:', e.message); }

  console.log('');
  console.log('--- AMOSTRA AUDIT_LOGS (ultimos 10) ---');
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) console.log('Erro:', error.message);
    else if (data && data.length > 0) {
      data.forEach((a,i) => console.log(`  [${i+1}] ${new Date(a.created_at).toLocaleString('pt-BR')} user=${a.user_name||'?'} action=${a.action} details=${JSON.stringify(a.details||'').substring(0,60)}`));
    } else {
      console.log('  (tabela vazia ou nao existe)');
    }
  } catch(e) { console.log('Excecao:', e.message); }

  console.log('');
  console.log('--- UNIDADES (SETOR) CADASTRADAS ---');
  try {
    const { data, error } = await supabase.from('units').select('*').order('title');
    if (error) console.log('Erro:', error.message);
    else if (data && data.length > 0) {
      data.forEach((u,i) => console.log(`  [${i+1}] id=${u.id.substring(0,8)}... title="${u.title}"`));
    } else {
      console.log('  (nenhuma unidade cadastrada)');
    }
  } catch(e) { console.log('Excecao:', e.message); }
}
run().then(()=>process.exit(0)).catch(e=>{console.error('FATAL:',e);process.exit(1)});
