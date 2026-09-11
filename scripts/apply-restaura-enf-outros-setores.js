require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
const fs = require('fs');
const glob = require('path');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

// 1) Carregar o plano salvo (último da pasta backup, filtrando estritamente JSON)
const backupDir = require('path').join(process.cwd(), 'backup');
const allFiles = fs.readdirSync(backupDir).map(f => {
  const full = require('path').join(backupDir, f);
  const stat = fs.statSync(full);
  return { name: f, full, time: stat.mtimeMs };
});
const planos = allFiles.filter(f => /^plano_restaura_setores_\d+\.json$/.test(f.name));
planos.sort((a, b) => b.time - a.time);
if (!planos.length) { console.log("Nenhum plano encontrado"); process.exit(1); }
const planoPath = planos[0].full;
console.log("Carregando plano:", planoPath, "(última modificação =", new Date(planos[0].time).toISOString(), ")");
const plano = JSON.parse(fs.readFileSync(planoPath, 'utf8'));

(async () => {
  const meses = [7, 8];
  let totalInseridos = 0;
  let totalSetores = 0;

  for (const unidade of plano) {
    totalSetores++;
    console.log("\n=== "+unidade.unit_title+" ===");
    console.log("  Nurses a alocar:", unidade.profissionais.length);
    for (const month of meses) {
      // checar existentes para evitar duplicação
      const existentes = (await sb.from('monthly_rosters').select('id,nurse_id')
        .eq('unit_id', unidade.unit_id)
        .eq('year', 2026).eq('month', month)
        .eq('section_id', unidade.section_id)).data || [];
      const existIds = new Set(existentes.map(r => r.nurse_id));

      const inserir = unidade.profissionais.filter(p => !existIds.has(p.nurse_id));
      console.log("    mês "+month+"/26: já existiam "+existIds.size+" | vai inserir "+inserir.length);
      if (!inserir.length) continue;

      const rows = inserir.map(p => ({
        id: randomUUID(),
        nurse_id: p.nurse_id,
        unit_id: unidade.unit_id,
        section_id: unidade.section_id,
        month,
        year: 2026,
        list_order: p.list_order ?? 10000,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await sb.from('monthly_rosters').insert(rows).select('id');
      if (error) { console.log("ERR insert mes "+month+":", error); process.exit(2); }
      totalInseridos += (data||[]).length;
      console.log("    OK inseridos "+(data||[]).length+" - total geral agora = "+totalInseridos);
      inserir.forEach(p => console.log("      + "+p.nome.trim()));
    }
  }

  console.log("\n\n=== CONFIRMAÇÃO FINAL (contagens bloco ENFERMEIROS section id =", plano[0].section_id+"): ===");
  const header = "Setor".padEnd(44," ") + "  | JUL | AGO | SET";
  console.log(header);
  console.log("-".repeat(header.length));
  let tudoOK = true;
  for (const u of plano) {
    let c7 = 0, c8 = 0, c9 = 0;
    for (const m of [7,8,9]) {
      const { count } = await sb.from('monthly_rosters').select('count', { count: 'exact', head: true })
        .eq('unit_id', u.unit_id).eq('year', 2026).eq('month', m).eq('section_id', u.section_id);
      if (m===7) c7 = count||0;
      if (m===8) c8 = count||0;
      if (m===9) c9 = count||0;
    }
    const ok = (c7===6 && c8===6 && c9===6);
    if (!ok) tudoOK = false;
    console.log(u.unit_title.padEnd(44," ").slice(0,44) + " | " +
      String(c7).padStart(3," ") + " | " +
      String(c8).padStart(3," ") + " | " +
      String(c9).padStart(3," ") + "  " + (ok ? "✅" : "⚠️"));
  }
  console.log("\nInserções totais =", totalInseridos, "em", totalSetores, "setores");
  console.log(tudoOK ? "\n🎉 TODAS AS 7 UNIDADES COM 6 ENFS EM JUL-AGO-SET (100% restaurado)" : "\n⚠️ Verificar acima - algumas contagens não fecharam = 6");
})();
