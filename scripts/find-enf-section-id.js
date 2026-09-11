require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

(async () => {
  // 1) Encontrar POSTO 1
  const { data: units } = await sb.from('units').select('id,title').ilike('title','%POSTO 1%');
  const posto = (units||[])[0];
  if (!posto) { console.log("POSTO1 NAO"); return; }
  console.log("POSTO1 id =", posto.id);

  // 2) Todas schedule_sections com titulo = "ENFERMEIROS"
  const { data: secs, error } = await sb.from('schedule_sections')
    .select('*')
    .ilike('title','%ENFERMEIRO%')
    .order('position', { ascending: true });
  console.log("\nSections com titulo ENFERMEIRO (qtd="+(secs||[]).length+"): ");
  (secs||[]).forEach(s=>console.log("  id=", s.id, "title=", s.title, "sector_title=", s.sector_title, "pos=", s.position));

  // 3) Usar uma section "ENFERMEIROS" de setembro/POSTO1 (sabemos que existe)
  // Como sections não tem unit_id (é cross-unit), temos que achar via roster
  for (const m of [9]) {
    const { data: rostersMes } = await sb.from('monthly_rosters')
      .select('section_id,nurse_id,unit_id,nurses(name,role)')
      .eq('unit_id', posto.id).eq('year', 2026).eq('month', m);
    const bySection = {};
    (rostersMes||[]).forEach(r => {
      if (!bySection[r.section_id]) bySection[r.section_id] = new Set();
      bySection[r.section_id].add(JSON.stringify({ id:r.nurse_id, nome: r.nurses?.name, role: r.nurses?.role }));
    });
    console.log("\n=== Mes "+m+"/26 POSTO1 sections e seus nurses (role=ENFERMEIRO contados): ===");
    for (const sid of Object.keys(bySection)) {
      const arr = [...bySection[sid]].map(s=>JSON.parse(s));
      const nEnf = arr.filter(x=>x.role==="ENFERMEIRO").length;
      const nTec = arr.filter(x=>x.role==="TECNICO").length;
      // buscar title section
      const sec = (secs||[]).find(s=>s.id===sid);
      const titulo = sec ? sec.title : "(outro section, buscar)";
      console.log("  section_id="+sid+"  title=\""+titulo+"\"  ENFs="+nEnf+"  TECs="+nTec);
      if (nEnf >= 3) arr.filter(x=>x.role==="ENFERMEIRO").slice(0,8).forEach(x=>console.log("     - "+x.nome));
      if (!sec) {
        // buscar titulo via id
        const { data: secData } = await sb.from('schedule_sections').select('title').eq('id', sid).limit(1);
        if (secData && secData[0]) console.log("     (titulo via lookup): "+secData[0].title);
      }
    }
  }

  // 4) Verificar se section "ENFERMEIROS" (id do setembro) tem ALGUM roster em julho ou agosto
  console.log("\n=== BUSCA de rosters na mesma section_id de ENFERMEIROS (setembro) em julho/agosto ===");
  // descobrir o sectionIdENF
  const { data: r9 } = await sb.from('monthly_rosters').select('section_id,nurse_id,nurses(role)').eq('unit_id', posto.id).eq('year', 2026).eq('month', 9);
  const secCount = {};
  (r9||[]).forEach(r => { if (r.nurses?.role === 'ENFERMEIRO') secCount[r.section_id] = (secCount[r.section_id]||0)+1; });
  const secIdEnf = Object.keys(secCount).sort((a,b)=>secCount[b]-secCount[a])[0];
  console.log("sectionId ENFERMEIROS (maioria em setembro):", secIdEnf, " | QTD enfs=", secCount[secIdEnf]);

  for (const m of [7,8,9]) {
    const { data: rs } = await sb.from('monthly_rosters').select('count', { count: 'exact', head: true })
      .eq('unit_id', posto.id).eq('year', 2026).eq('month', m).eq('section_id', secIdEnf);
    console.log("  mes "+m+"/26 -> count rosters na section ENFERMEIROS =", (rs?.count ?? 0));
  }

  // 5) Pessoas da section ENFERMEIROS de setembro -> listar com nurse_id, section_id, unit_id
  console.log("\n=== Pessoas do bloco ENFERMEIROS (setembro/POSTO1) para duplicação julho/agosto: ===");
  const { data: enfsSetembro, error: errEnfs } = await sb.from('monthly_rosters')
    .select('id,nurse_id,section_id,unit_id,month,year,list_order,professionals:monthly_rosters_nurse_id_fkey(name,role,coren,vinculo)')
    .eq('unit_id', posto.id).eq('year', 2026).eq('month', 9).eq('section_id', secIdEnf);
  if (errEnfs) { console.log("err:", errEnfs); }
  else {
    const uniq = {};
    (enfsSetembro||[]).forEach(r => { if (!uniq[r.nurse_id]) uniq[r.nurse_id] = r; });
    Object.values(uniq).forEach((r) => {
      const p = r.professionals || {};
      console.log("  nurse_id="+r.nurse_id+" nome="+p.name+" role="+p.role+" coren="+p.coren+" vinculo="+p.vinculo+" list_order="+r.list_order);
    });
  }
})();
