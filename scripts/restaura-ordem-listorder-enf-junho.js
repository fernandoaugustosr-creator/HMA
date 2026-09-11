const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const BKP_ANTIGO = path.join(process.cwd(), 'backup', 'backup_2026_08_21_18_59_41');
const SECTION_ENF_ID = '78a6af33-dc6b-4953-9b04-0949ce8e3751';

const UNIDADES = [
  { id: '88a0fd99-4aac-41c8-a4c0-7d39fc7f9d4e', title: 'POSTO 1' },
  { id: '5f58e6b2-8561-4da4-98c8-e536280befa4', title: 'UTI- ENFERMEIROS' },
  { id: '952e3d2d-161c-478b-9898-06f3f4efd3c6', title: 'PRONTO SOCORRO ENFERMEIRO' },
  { id: '74a95bab-0bf0-4c40-b19f-ae0684044161', title: 'CLASSIFICAÇÃO DE RISCO' },
  { id: '4a370477-c651-45bd-8265-9306411b608a', title: 'NIR' },
  { id: '459bb78d-af1d-41eb-87ac-5ecad492534b', title: 'POSTO 2' },
  { id: '27fdf8c5-7a24-4afc-8215-bc163f07773b', title: 'NEONATOLOGIA E PEDIATRIA' },
  { id: '556c3ed4-23b5-4447-a0a9-a3a6773f9343', title: 'CENTRO CIRÚRGICO OBSTÉTRICO (CCO)' }
];

(async () => {
  // 1) Carregar dados do backup antigo (18_59_41, ANTES de qualquer alteração nossa)
  const bkpRosters = JSON.parse(fs.readFileSync(path.join(BKP_ANTIGO, 'monthly_rosters.json'), 'utf8'));
  const bkpNurses = JSON.parse(fs.readFileSync(path.join(BKP_ANTIGO, 'nurses.json'), 'utf8'));

  const planoAtualizacoes = []; // items = {unit_id, month, nurse_id, list_order_novo, nome}

  for (const unid of UNIDADES) {
    console.log("\n=========== "+unid.title+" ===========");

    // ====== PASSO 1: Encontrar ORDEM ORIGINAL (JUNHO/2026) no BACKUP ======
    const rostersJunhoBackup = bkpRosters.filter(r =>
      r.unit_id === unid.id && r.year === 2026 && r.month === 6 && r.section_id === SECTION_ENF_ID
    );
    console.log("   > Junho/2026 NO BACKUP ORIGINAL: rosters encontrados =", rostersJunhoBackup.length);
    // Remover duplicatas (1 nurse por list_order - única entrada)
    const ordemOriginal = new Map(); // nurse_id => list_order
    for (const r of rostersJunhoBackup) {
      if (!ordemOriginal.has(r.nurse_id)) ordemOriginal.set(r.nurse_id, r.list_order);
    }
    // Mostrar ordem original
    const arrOriginal = [...ordemOriginal.entries()].map(([nid, lo]) => {
      const n = bkpNurses.find(x => x.id === nid);
      return { nurse_id: nid, list_order: lo, nome: n?.name || "?" };
    }).sort((a, b) => (a.list_order || 99999) - (b.list_order || 99999));
    console.log("   > Ordem ORIGINAL (junho no backup):");
    arrOriginal.forEach((x, i) => console.log(`     ${i + 1}. [list_order=${x.list_order}] ${x.nome}`));

    // ====== PASSO 2: Se NÃO temos junho no backup, tentar puxar JULHO do backup ======
    let ordemUsar = ordemOriginal;
    if (arrOriginal.length === 0) {
      console.log("   !! Sem junho no backup antigo. Tentar JULHO/26 no backup original...");
      const rostersJulBackup = bkpRosters.filter(r =>
        r.unit_id === unid.id && r.year === 2026 && r.month === 7 && r.section_id === SECTION_ENF_ID
      );
      console.log("   > Julho/26 NO BACKUP: rosters encontrados =", rostersJulBackup.length);
      ordemUsar = new Map();
      for (const r of rostersJulBackup) if (!ordemUsar.has(r.nurse_id)) ordemUsar.set(r.nurse_id, r.list_order);
    }

    // ====== PASSO 3: Pegar o roster ATUAL (julho/agosto hoje no Supabase) ======
    for (const mes of [7, 8]) {
      const { data: rostersAtuais } = await sb.from('monthly_rosters')
        .select('id,nurse_id,list_order')
        .eq('unit_id', unid.id).eq('year', 2026).eq('month', mes)
        .eq('section_id', SECTION_ENF_ID);
      const current = (rostersAtuais || []).map(r => ({ id: r.id, nurse_id: r.nurse_id, lo_atual: r.list_order }));
      console.log(`   > Atual mês ${mes}/26 (Supabase): ${current.length} enfermeiros`);

      // Para cada roster atual, mapear nurse_id -> pegar ordem do ordemUsar
      const updates = [];
      for (const r of current) {
        const loOrig = ordemUsar.get(r.nurse_id);
        if (loOrig !== undefined && loOrig !== null && Number(loOrig) !== Number(r.lo_atual)) {
          updates.push({ id: r.id, nurse_id: r.nurse_id, lo_antigo: r.lo_atual, lo_novo: Number(loOrig), mes, unit_id: unid.id, unit_title: unid.title });
        }
      }
      console.log(`     Rows que precisam atualizar list_order (mes ${mes}): ${updates.length}`);
      updates.slice(0, 10).forEach(u => {
        const n = bkpNurses.find(x => x.id === u.nurse_id);
        console.log(`       * ${n?.name || "?"}: ${u.lo_antigo} -> ${u.lo_novo}`);
      });
      planoAtualizacoes.push(...updates);
    }
  }

  // ====== PASSO 4: Aplicar os updates ======
  console.log("\n\n=========== APLICANDO UPDATES (TOTAL: " + planoAtualizacoes.length + " linhas) ===========");
  const updatesPorMes = { 7: 0, 8: 0 };
  for (const u of planoAtualizacoes) {
    const { error } = await sb.from('monthly_rosters').update({ list_order: u.lo_novo }).eq('id', u.id);
    if (error) { console.log("   ERR update id=" + u.id + ":", error.message); }
    else updatesPorMes[u.mes]++;
  }
  console.log("   > Atualizados com sucesso: julho=" + updatesPorMes[7] + "  agosto=" + updatesPorMes[8]);

  // ====== PASSO 5: Confirmação final ======
  console.log("\n=========== CONFIRMAÇÃO FINAL - Ordem atual em julho/agosto no Supabase ===========");
  for (const unid of UNIDADES) {
    console.log("\n  " + unid.title);
    for (const mes of [7, 8]) {
      const { data: rows } = await sb.from('monthly_rosters')
        .select('nurse_id,list_order,nurses(name)')
        .eq('unit_id', unid.id).eq('year', 2026).eq('month', mes).eq('section_id', SECTION_ENF_ID)
        .order('list_order', { ascending: true });
      console.log(`    Mês ${mes}/26 (ordem por list_order):`);
      (rows || []).forEach((r, i) => console.log(`       ${i + 1}. [list_order=${r.list_order}] ${r.nurses?.name || "?"}`));
    }
  }
})();
