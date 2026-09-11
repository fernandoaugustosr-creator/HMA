require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

const SECTION_ENF_ID = '78a6af33-dc6b-4953-9b04-0949ce8e3751'; // bloco ENFERMEIROS

const UNIDADES_ALVO = [
  { id: '88a0fd99-4aac-41c8-a4c0-7d39fc7f9d4e', title: 'POSTO 1' },
  { id: '5f58e6b2-8561-4da4-98c8-e536280befa4', title: 'UTI- ENFERMEIROS' },
  { id: '952e3d2d-161c-478b-9898-06f3f4efd3c6', title: 'PRONTO SOCORRO ENFERMEIRO' },
  { id: '74a95bab-0bf0-4c40-b19f-ae0684044161', title: 'CLASSIFICAÇÃO DE RISCO' },
  { id: '4a370477-c651-45bd-8265-9306411b608a', title: 'NIR' },
  { id: '459bb78d-af1d-41eb-87ac-5ecad492534b', title: 'POSTO 2' },
  { id: '27fdf8c5-7a24-4afc-8215-bc163f07773b', title: 'NEONATOLOGIA E PEDIATRIA' },
  { id: '556c3ed4-23b5-4447-a0a9-a3a6773f9343', title: 'CENTRO CIRÚRGICO OBSTÉTRICO (CCO)' }
];

const mesesDestino = [7, 8]; // julho + agosto
const mesOrigem = 9; // setembro = modelo
const ano = 2026;

function fmtData(ano, mes, dia) {
  const m = String(mes).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  return `${ano}-${m}-${d}`;
}

(async () => {
  let totalInseridos = 0;
  let totalLidos = 0;
  const auditoria = [];

  for (const unidade of UNIDADES_ALVO) {
    console.log("\n============== "+unidade.title+" ==============");
    const contUnit = { lidos: 0, inseridos: { 7: 0, 8: 0 }, skipExistentes: { 7: 0, 8: 0 } };

    // 1) Carregar rosters da unidade nos meses 7/8/9 no bloco ENF
    const { data: rosters } = await sb.from('monthly_rosters')
      .select('id,nurse_id,section_id,month')
      .eq('unit_id', unidade.id).eq('year', ano).in('month', [7,8,9])
      .eq('section_id', SECTION_ENF_ID);
    // mapa1: origem (nurse_id, mes_origem) -> roster_id (setembro)
    // mapa2: destino (nurse_id, mes_dest) -> novo roster_id (julho agosto)
    const mapaRoster = {}; // key = nurse_id|mes  => roster_id
    (rosters||[]).forEach(r => { mapaRoster[`${r.nurse_id}|${r.month}`] = r.id; });
    console.log("  mapa rosters ENF (qtd chaves):", Object.keys(mapaRoster).length);

    const rostersSetembroIds = (rosters||[]).filter(r => r.month === mesOrigem).map(r => r.id);
    if (!rostersSetembroIds.length) {
      console.log("  !! Nenhum roster setembro ENF nesta unidade. skip.");
      auditoria.push({ unidade: unidade.title, modelo_set: 0, novos_Jul: 0, novos_Ago: 0 });
      continue;
    }

    // 2) Shifts do setembro ligados aos roster_ids de setembro da unidade
    const { data: shiftsModelo, error: errShifts } = await sb.from('shifts')
      .select('id,roster_id,nurse_id,date,type,is_red')
      .in('roster_id', rostersSetembroIds);
    if (errShifts) { console.log("  ERR shifts:", errShifts); continue; }
    contUnit.lidos = (shiftsModelo||[]).length;
    totalLidos += contUnit.lidos;
    console.log("  plantões lidos de setembro (modelo):", contUnit.lidos);

    // 3) Para cada shift, duplicar em julho e agosto
    const batch = [];
    for (const t of (shiftsModelo||[])) {
      const d = new Date(t.date);
      if (d.getFullYear() !== ano || (d.getMonth()+1) !== mesOrigem) continue; // garantir setembro
      const dia = d.getDate();

      for (const mesDest of mesesDestino) {
        const diasNoMes = new Date(ano, mesDest, 0).getDate();
        if (dia > diasNoMes) continue; // segurança (set=30 → se mes=31 ok, fevereiro etc.)
        // buscar novo_roster_id da nurse no mesDest
        const novaData = fmtData(ano, mesDest, dia);
        const chave = `${t.nurse_id}|${mesDest}`;
        const novoRosterId = mapaRoster[chave];
        if (!novoRosterId) { /* não tem roster desse nurse no mês destino. skip */ continue; }

        // Checar se já existe exatamente esse plantão
        const { count: jaExiste } = await sb.from('shifts').select('id', { count: 'exact', head: true })
          .eq('nurse_id', t.nurse_id)
          .eq('date', novaData)
          .eq('type', t.type || '')
          .eq('roster_id', novoRosterId);
        if (jaExiste > 0) {
          contUnit.skipExistentes[mesDest]++;
          continue;
        }

        batch.push({
          id: randomUUID(),
          nurse_id: t.nurse_id,
          roster_id: novoRosterId,
          date: novaData,
          type: t.type || null,
          is_red: !!t.is_red,
          created_at: new Date().toISOString()
        });
      }
    }

    if (batch.length) {
      const CHUNK = 500;
      for (let i = 0; i < batch.length; i += CHUNK) {
        const part = batch.slice(i, i + CHUNK);
        const { error } = await sb.from('shifts').insert(part);
        if (error) { console.log("  ERR insert shifts chunk:", error); process.exit(3); }
        const porMes = {};
        part.forEach(p => {
          const m = Number(p.date.slice(5,7));
          porMes[m] = (porMes[m]||0)+1;
        });
        if (porMes[7]) { contUnit.inseridos[7] += porMes[7]; totalInseridos += porMes[7]; }
        if (porMes[8]) { contUnit.inseridos[8] += porMes[8]; totalInseridos += porMes[8]; }
      }
    }
    console.log("  inseridos julho:", contUnit.inseridos[7], " (skip:", contUnit.skipExistentes[7], ")");
    console.log("  inseridos agosto:", contUnit.inseridos[8], " (skip:", contUnit.skipExistentes[8], ")");
    auditoria.push({ unidade: unidade.title, modelo_set: contUnit.lidos, novos_Jul: contUnit.inseridos[7], novos_Ago: contUnit.inseridos[8] });
  }

  console.log("\n\n========== RESUMO FINAL SHIFTS (SET -> JUL/AGO) ==========");
  const header = "Setor".padEnd(45," ") + " | SET(modelo) | JUL novos | AGO novos";
  console.log(header);
  console.log("-".repeat(header.length));
  let tudoOK = true;
  for (const row of auditoria) {
    const set = row.modelo_set;
    const ok = (row.novos_Jul >= Math.max(0, set-5)) && (row.novos_Ago >= Math.max(0, set-5));
    if (!ok) tudoOK = false;
    console.log(row.unidade.padEnd(45," ").slice(0,45) + " | " +
      String(set).padStart(10," ") + " | " +
      String(row.novos_Jul).padStart(9," ") + " | " +
      String(row.novos_Ago).padStart(9," ") + "  " + (ok ? "✅" : "⚠️"));
  }
  console.log("\nTotal plantões modelo (setembro):", totalLidos);
  console.log("Total inseridos em julho+agosto:", totalInseridos);
  console.log(tudoOK ? "\n🎉 SUCESSO: plantões de trabalho duplicados para julho/agosto em todos os setores!" : "\n⚠️ Aviso: alguns setores com pequena diferença (dias 31 vs 30, ou ja existia).");
})();
