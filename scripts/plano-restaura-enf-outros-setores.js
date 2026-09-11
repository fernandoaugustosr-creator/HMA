require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

const ALVO_TITLES = [
  'UTI- ENFERMEIROS',
  'PRONTO SOCORRO ENFERMEIRO',
  'CLASSIFICAÇÃO DE RISCO',
  'NIR',
  'POSTO 2',
  'NEONATOLOGIA E PEDIATRIA',
  'CENTRO CIRÚRGICO OBSTÉTRICO (CCO)'
];

(async () => {
  const plano = [];

  for (const t of ALVO_TITLES) {
    console.log("\n============== UNIDADE: "+t+" ==============");
    const { data: uRs } = await sb.from('units').select('id,title').ilike('title', t.replace(/[()]/g,'%').replace(/ +/g,'%')+'%').limit(3);
    const unit = (uRs||[])[0];
    if (!unit) { console.log("  !! UNIDADE NÃO ENCONTRADA"); continue; }
    console.log("  unit_id =", unit.id, " | title =", unit.title);

    // Encontrar section_id que concentra a maioria dos ENFERMEIROS role em setembro
    const { data: r9 } = await sb.from('monthly_rosters')
      .select('section_id,nurse_id,nurses(name,role)')
      .eq('unit_id', unit.id).eq('year',2026).eq('month',9);
    const bySec = {};
    (r9||[]).forEach(r => {
      if (r.nurses?.role !== 'ENFERMEIRO') return;
      bySec[r.section_id] = bySec[r.section_id] || { count: 0, nurses: new Map() };
      if (!bySec[r.section_id].nurses.has(r.nurse_id)) {
        bySec[r.section_id].nurses.set(r.nurse_id, { nome: r.nurses.name });
        bySec[r.section_id].count++;
      }
    });
    // pegar a section com mais enfermeiros
    let secId = null, max = 0;
    Object.keys(bySec).forEach(sid => { if (bySec[sid].count > max) { max = bySec[sid].count; secId = sid; } });
    if (!secId) { console.log("  !! NÃO ACHEI SECTION DE ENFs em setembro"); continue; }
    const secTit = (await sb.from('schedule_sections').select('title,position').eq('id', secId).limit(1).maybeSingle())?.data;
    console.log("  section ENFERMEIROS (setembro) id =", secId, " title =", secTit?.title, " pos =", secTit?.position);

    // Buscar os nurses únicos da section ENF em setembro (até 6) com list_order do roster
    const { data: rosters } = await sb.from('monthly_rosters')
      .select('id,nurse_id,list_order,nurses(name,role,coren,vinculo)')
      .eq('unit_id', unit.id).eq('year',2026).eq('month',9).eq('section_id', secId);
    const uniqueNurses = new Map();
    (rosters||[]).forEach(r => {
      if (!uniqueNurses.has(r.nurse_id)) {
        uniqueNurses.set(r.nurse_id, {
          nurse_id: r.nurse_id,
          nome: r.nurses?.name,
          role: r.nurses?.role,
          coren: r.nurses?.coren,
          vinculo: r.nurses?.vinculo,
          list_order: r.list_order ?? (10000 + uniqueNurses.size + 1)
        });
      }
    });
    const arr = [...uniqueNurses.values()];
    console.log("  ENFs únicos em setembro:", arr.length);
    arr.slice(0,8).forEach(x => console.log("    - "+x.nome+" | "+x.role+" | "+x.vinculo+" | coren="+x.coren+" | order="+x.list_order));

    // Contagem existente em julho e agosto para essa section
    let c7 = 0, c8 = 0, c9 = 0;
    for (const m of [7,8,9]) {
      const { count } = await sb.from('monthly_rosters').select('count', { count: 'exact', head: true })
        .eq('unit_id', unit.id).eq('year',2026).eq('month',m).eq('section_id', secId);
      if (m===7) c7 = count||0; if (m===8) c8 = count||0; if (m===9) c9 = count||0;
    }
    console.log("  Contagens no bloco ENF dessa unit: JUL="+c7+"  AGO="+c8+"  SET="+c9);

    plano.push({
      unit_id: unit.id, unit_title: unit.title,
      section_id: secId, section_title: secTit?.title, section_position: secTit?.position,
      profissionais: arr.slice(0,8),
      contagem: { jul: c7, ago: c8, set: c9 }
    });
  }

  // Salvar plano em JSON para usar no próximo script de inserção
  const out = require('path').join(process.cwd(), 'backup', 'plano_restaura_setores_'+Date.now()+'.json');
  fs.writeFileSync(out, JSON.stringify(plano, null, 2));
  console.log("\n\nPlano de restauração salvo em:", out);
  console.log("Setores processados:", plano.length);
})();
