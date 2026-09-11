require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

const POSTO1_ID = '88a0fd99-4aac-41c8-a4c0-7d39fc7f9d4e';
const SECTION_ENF_ID = '78a6af33-dc6b-4953-9b04-0949ce8e3751';

// 6 nurses do bloco ENFERMEIROS de setembro POSTO 1 (verificado no find-enf-section-id.js)
const ENF_PROFISSIONAIS = [
  { nurse_id: '43aa1a04-ea08-41b4-80bf-e4d91df339ea', nome: 'CLEIZE EDIANI SILVA DOS SANTOS',       list_order: 10001 },
  { nurse_id: 'bcd4a0a5-87da-43e6-b93b-ebccab8ac811', nome: 'TERESINHA  MARIA DE CARVALHO',      list_order: 10002 },
  { nurse_id: '2ede489d-2c5f-453c-97e5-7eb1e61496bb', nome: 'JAILCICLEIA DOS SANTOS CONCEIÇÃO',  list_order: 10003 },
  { nurse_id: 'f6d7fa67-779c-46ff-9ffc-ee228969cffc', nome: 'ROSA DE JESUS BARBOSA CAMPOS',      list_order: 10004 },
  { nurse_id: '9e2e9994-0258-4911-a08a-5768e42b677d', nome: 'FERNANDA KETLEN SOUSA ARAGÃO',     list_order: 10005 },
  { nurse_id: '9f2f3fbd-8870-40be-b590-a654d3949652', nome: 'KACILANDIA DE SA GASPAR',           list_order: 10006 },
];

(async () => {
  const meses = [7, 8]; // julho + agosto 2026
  for (const month of meses) {
    // Verificar se já existe algum destes nurses neste mês/section/unidade para evitar duplicatas (segurança)
    const { data: existentes, error: errExist } = await sb.from('monthly_rosters')
      .select('id,nurse_id')
      .eq('unit_id', POSTO1_ID)
      .eq('year', 2026)
      .eq('month', month)
      .eq('section_id', SECTION_ENF_ID);
    if (errExist) { console.log("ERRO consultar existentes mes "+month+":", errExist); process.exit(1); }
    const existNurseIds = new Set((existentes||[]).map(r=>r.nurse_id));
    console.log("\n=== MÊS "+month+"/2026 POSTO1 bloco ENFERMEIROS ===");
    console.log("Já existiam no bloco:", existNurseIds.size, " nurses");

    const inserir = ENF_PROFISSIONAIS.filter(p => !existNurseIds.has(p.nurse_id));
    console.log("Vai inserir novos:", inserir.length, " (de "+ENF_PROFISSIONAIS.length+")");
    if (inserir.length === 0) { console.log("  (nada a inserir neste mês)"); continue; }

    const rows = inserir.map(p => ({
      id: randomUUID(),
      nurse_id: p.nurse_id,
      unit_id: POSTO1_ID,
      section_id: SECTION_ENF_ID,
      month,
      year: 2026,
      list_order: p.list_order,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await sb.from('monthly_rosters').insert(rows).select();
    if (error) { console.log("ERRO INSERT mes "+month+":", error); process.exit(2); }
    console.log("OK - inseridos "+(data||[]).length+" rosters no mes "+month+" / 2026 no bloco ENFERMEIROS POSTO 1");
    (data||[]).forEach(r => {
      const prof = ENF_PROFISSIONAIS.find(p=>p.nurse_id===r.nurse_id);
      console.log("   + "+(prof?.nome||"?"));
    });
  }

  // RESULTADO: contar quantos tem agora em cada mês + setembro para confirmar
  console.log("\n=== CONFIRMAÇÃO FINAL: count rosters no bloco ENFERMEIROS POSTO 1 ===");
  for (const m of [7,8,9]) {
    const { count } = await sb.from('monthly_rosters').select('count', { count: 'exact', head: true })
      .eq('unit_id', POSTO1_ID).eq('year', 2026).eq('month', m).eq('section_id', SECTION_ENF_ID);
    console.log("  mês "+m+"/26: "+count+" profissionais no bloco ENFERMEIROS");
  }
})();
