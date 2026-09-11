require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error("Faltando credenciais Supabase no .env.local"); process.exit(1); }
const sb = createClient(url, key);

(async () => {
  // 1) Encontrar POSTO 1
  const { data: units, error: ue } = await sb.from('units').select('id,title').ilike('title','%POSTO 1%').limit(3);
  if (ue) { console.error("units err:", ue); return; }
  console.log("units POSTO 1:", JSON.stringify(units, null, 2));
  if (!units || !units.length) return;
  const posto = units[0];

  // 2) schedule_sections (talvez plural)
  const tryTables = ['schedule_sections', 'sections', 'blocos'];
  let sects = null, sectionsTableName = null;
  for (const t of tryTables) {
    try {
      const res = await sb.from(t).select('*').limit(10);
      if (res.error) { console.log("  skip table", t, "=>", res.error.message.split("\n")[0]); continue; }
      sects = res.data || [];
      sectionsTableName = t;
      console.log("\nTabela encontrada:", t, " | total rows:", (await sb.from(t).select('*', { count: 'exact', head: true })).count);
      break;
    } catch(e) { console.log("  err table "+t+": "+e.message); }
  }
  if (!sects) { console.log("Nenhuma tabela sections encontrada"); return; }
  console.log("schedule_sections AMOSTRAS:");
  sects.slice(0,10).forEach(s=>console.log("  ",JSON.stringify(s)));

  // 3) Todos rosters AGOSTO e SETEMBRO 2026 POSTO 1, junto com section title e role nurse
  for (const m of [8,9]) {
    const { data: rosters, error: re } = await sb.from('monthly_rosters')
      .select('id,nurse_id,section_id,unit_id,month,year,nurses(name,role,coren,vinculo),sections:section_id(title)')
      .eq('unit_id', posto.id).eq('year', 2026).eq('month', m);
    if (re) { console.log("\nrosters mes "+m+" err:", re); continue; }
    const unique = {};
    (rosters||[]).forEach(r => {
      const n = r.nurses || {};
      const s = r.sections || { title: "(sem secao)" };
      const key = (r.section_id||'x') + "::" + (n.role||'?') + "::" + r.nurse_id;
      if (!unique[key]) unique[key] = { section_id: r.section_id, section_title: s?.title, role: n.role, nurses: new Set() };
      unique[key].nurses.add((n.name||"").trim() + " [" + (n.coren||"?") + "] v=" + (n.vinculo||"?"));
    });
    console.log("\n================= MÊS "+m+"/2026 "+posto.title+" por section + role: =================");
    const keys = Object.keys(unique).sort();
    keys.forEach(k => {
      const { section_title, role, nurses } = unique[k];
      const arr = [...nurses].sort();
      console.log(`  [${section_title||"???"}]  role=${role}  qtd=${arr.length}`);
      arr.slice(0,6).forEach(nm => console.log("     - "+nm));
      if (arr.length > 6) console.log("     ... (mais "+(arr.length-6)+")");
    });
  }

  // 4) Todos os setores em 8/26 e 9/26, contar ENFERMEIRO distintos
  console.log("\n================= Resumo GLOBAL - por unidade: ENFs em AGOSTO vs SETEMBRO/2026 =================");
  const { data: allUnits, error: eu } = await sb.from('units').select('id,title').order('title');
  if (!eu && allUnits) {
    const cont = {};
    for (const u of allUnits) cont[u.id] = { title: u.title, m8: new Set(), m9: new Set() };
    for (const m of [8,9]) {
      const { data: rs, error } = await sb.from('monthly_rosters').select('unit_id,nurse_id,nurses(role)').eq('year',2026).eq('month',m);
      (rs||[]).forEach(r => {
        const n = r.nurses;
        if (n && n.role === "ENFERMEIRO") {
          if (m===8) (cont[r.unit_id] = cont[r.unit_id] || {title:"", m8:new Set(), m9:new Set()}).m8.add(r.nurse_id);
          else (cont[r.unit_id] = cont[r.unit_id] || {title:"", m8:new Set(), m9:new Set()}).m9.add(r.nurse_id);
        }
      });
    }
    const rows = Object.values(cont).filter(r=>r.m8.size>0 || r.m9.size>0).sort((a,b)=> (b.m9.size-b.m8.size) - (a.m9.size-a.m8.size));
    rows.forEach(r => console.log(`  ${r.title.padEnd(45)} | AGOSTO ENFs=${r.m8.size.toString().padStart(2)} | SETEMBRO ENFs=${r.m9.size.toString().padStart(2)} ${r.m8.size===0 && r.m9.size>0?" ⚠️ (só setembro)":""}`));
  }
})();
