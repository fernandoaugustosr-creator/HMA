const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const BKP_ANTIGO = path.join(process.cwd(), 'backup', 'backup_2026_08_21_18_59_41');
const BKP_NOVO   = path.join(process.cwd(), 'backup', 'backup_2026_08_21_20_37_19');

const UNIDADES_ENF = [
  '88a0fd99-4aac-41c8-a4c0-7d39fc7f9d4e', // POSTO 1
  '5f58e6b2-8561-4da4-98c8-e536280befa4', // UTI- ENFERMEIROS
  '952e3d2d-161c-478b-9898-06f3f4efd3c6', // PRONTO SOCORRO ENFERMEIRO
  '74a95bab-0bf0-4c40-b19f-ae0684044161', // CLASSIFICAÇÃO DE RISCO
  '4a370477-c651-45bd-8265-9306411b608a', // NIR
  '459bb78d-af1d-41eb-87ac-5ecad492534b', // POSTO 2
  '27fdf8c5-7a24-4afc-8215-bc163f07773b', // NEONATOLOGIA E PEDIATRIA
  '556c3ed4-23b5-4447-a0a9-a3a6773f9343', // CCO
];

(async () => {
  const units = JSON.parse(fs.readFileSync(path.join(BKP_ANTIGO, 'units.json'), 'utf8'));
  const uMap = new Map(units.map(u => [u.id, u.title]));

  const oldMeta = JSON.parse(fs.readFileSync(path.join(BKP_ANTIGO, 'monthly_schedule_metadata.json'), 'utf8'));
  const newMeta = JSON.parse(fs.readFileSync(path.join(BKP_NOVO, 'monthly_schedule_metadata.json'), 'utf8'));

  const mesesAlvo = [4, 5, 6, 7, 8, 9]; // abril até setembro
  const chave = (u, m, a) => `${u}|${m}|${a}`;
  const oldMap = new Map(oldMeta.map(m => [chave(m.unit_id, m.month, m.year), m]));
  const newMap = new Map(newMeta.map(m => [chave(m.unit_id, m.month, m.year), m]));

  console.log("========== DIAGNÓSTICO: monthly_schedule_metadata (Escala Liberada) ==========");
  const header = "Setor".padEnd(40) + " | " + mesesAlvo.map(m => ("m"+m).padEnd(10)).join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));

  const linhaInfos = []; // para updates depois
  for (const uid of UNIDADES_ENF) {
    let linha = (uMap.get(uid) || "?").padEnd(40).slice(0, 40) + " | ";
    for (const m of mesesAlvo) {
      const key = chave(uid, m, 2026);
      const old = oldMap.get(key);
      const nw = newMap.get(key);
      const st = () => {
        if (!old && !nw) return "S/ METAD";
        const released = (nw?.is_released) ? "✅LIB" : "❌NÃO";
        const oldReleased = old?.is_released ? "✅ant" : "❌ant";
        return oldReleased + " → " + released;
      };
      linha += String(st()).padEnd(10) + " | ";

      // Guardar: se antigo era LIBERADO (true) e atual NÃO é (false) ou NÃO EXISTE -> precisa restaurar
      if (old?.is_released && !(nw?.is_released)) {
        linhaInfos.push({ unit_id: uid, unit_title: uMap.get(uid), month: m, year: 2026, novo_id: nw?.id, criar: !nw, antigo_val: old });
      }
    }
    console.log(linha);
  }

  console.log("\n\n========== SETORES QUE PRECISAM RESTAURAR IS_RELEASED = TRUE: ==========");
  console.log("Total =", linhaInfos.length);
  linhaInfos.slice(0, 50).forEach(r => console.log("  - "+r.unit_title+" / "+r.month+"/2026   " + (r.criar ? "(metadata NÃO EXISTIA, vai criar do zero)" : "(metadata existe mas is_released=false, vai setar true)")));

  // Aplicar updates/inserts
  let criados = 0, atualizados = 0;
  console.log("\n\n========== APLICANDO RESTAURAÇÃO ==========");
  for (const r of linhaInfos) {
    if (r.criar) {
      // Criar do zero, usando o modelo do antigo metadata
      const { error } = await sb.from('monthly_schedule_metadata').insert({
        unit_id: r.unit_id,
        month: r.month,
        year: 2026,
        is_released: true,
        released_at: r.antigo_val.released_at || new Date().toISOString(),
        released_by: r.antigo_val.released_by || null,
        notes: r.antigo_val.notes || 'Restaurado automaticamente backup 18_59_41'
      });
      if (error) console.log("   ERR criar "+r.unit_title+" m="+r.month+":", error.message);
      else criados++;
    } else {
      const { error } = await sb.from('monthly_schedule_metadata').update({
        is_released: true,
        released_at: (r.antigo_val && r.antigo_val.released_at) || new Date().toISOString(),
        released_by: r.antigo_val?.released_by || null
      }).eq('id', r.novo_id);
      if (error) console.log("   ERR update "+r.unit_title+" m="+r.month+":", error.message);
      else atualizados++;
    }
  }
  console.log("   OK: criados do zero =", criados, "   atualizados (de false→true) =", atualizados);

  // CONFIRMAÇÃO FINAL (puxando do Supabase AGORA)
  console.log("\n\n========== CONFIRMAÇÃO FINAL - SUPABASE AGORA ==========");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const uid of UNIDADES_ENF) {
    let linha = (uMap.get(uid)||"?").padEnd(40).slice(0,40) + " | ";
    for (const m of mesesAlvo) {
      const { data, error } = await sb.from('monthly_schedule_metadata').select('id,is_released')
        .eq('unit_id', uid).eq('year', 2026).eq('month', m).maybeSingle();
      if (error || !data) linha += "S/ METAD".padEnd(10) + " | ";
      else linha += (data.is_released ? "✅ LIB" : "❌ NÃO").padEnd(10) + " | ";
    }
    console.log(linha);
  }
})();
