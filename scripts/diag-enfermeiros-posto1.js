const fs = require("fs");
const path = require("path");
const bkp = "c:/Users/ferna/Documents/trae_projects/ENF-HMA/backup/backup_2026_08_21_18_59_41";
const units = JSON.parse(fs.readFileSync(path.join(bkp,"units.json"),"utf8"));
const rost = JSON.parse(fs.readFileSync(path.join(bkp,"monthly_rosters.json"),"utf8"));
const nurses = JSON.parse(fs.readFileSync(path.join(bkp,"nurses.json"),"utf8"));

// 1) Encontrar POSTO 1
const posto = units.find(u => /POSTO 1/i.test(u.title));
console.log("POSTO 1 id:", posto ? posto.id : "NAO ENCONTRADO");
console.log("\nTodas units com POSTO no nome:");
units.filter(u => /POSTO/i.test(u.title)).map(u=>({id:u.id,t:u.title})).slice(0,20).forEach(x=>console.log(" -",x.id, x.t));

// 2) Rosters agosto/2026 POSTO 1
if (posto) {
  const rostersMes = rost.filter(r => r.unit_id===posto.id && r.year===2026 && r.month===8);
  console.log("\nRosters AGOSTO/2026 POSTO 1 (qtd):", rostersMes.length);
  const byNurse = {};
  rostersMes.forEach(r => { byNurse[r.nurse_id] = (byNurse[r.nurse_id]||0)+1; });
  const nurseIds = Object.keys(byNurse);
  const nurseRows = nurseIds.map(nid => {
    const n = nurses.find(x=>x.id===nid);
    return { id:nid, nome:n?.full_name || "???", categoria:n?.category || "?", vinculo:n?.employment_type || "?", unit:posto.title };
  });
  console.log("ENFs/Tecs alocados em agosto POSTO1:", nurseRows.length);
  nurseRows.sort((a,b)=>a.nome.localeCompare(b.nome));
  const categorias = {};
  nurseRows.forEach(r=>{ categorias[r.categoria]=(categorias[r.categoria]||0)+1; });
  console.log("Distribuicao por categoria em AGOSTO/26 POSTO1:", JSON.stringify(categorias));
  nurseRows.slice(0,60).forEach(r=>console.log(" - "+r.nome+" | "+r.categoria+" | "+r.vinculo));

  // 3) Verificar se existe ALGUM enfermeiro (categoria contem ENFERMEIRO) alocado em algum mes de 2026 no POSTO1
  console.log("\n=== Todos enfermeiros (categoria ENFERMEIRO) alocados no POSTO1 em 2026 ===");
  const rosters2026 = rost.filter(r => r.unit_id===posto.id && r.year===2026);
  const enfermeirosNoPosto = {};
  rosters2026.forEach(r => {
    const n = nurses.find(x=>x.id===r.nurse_id);
    if (n && /ENFERMEIRO/i.test(n.category||"")) {
      const mes = r.month;
      if (!enfermeirosNoPosto[n.id]) enfermeirosNoPosto[n.id] = { nome:n.full_name, cat:n.category, meses:new Set() };
      enfermeirosNoPosto[n.id].meses.add(mes);
    }
  });
  const listEnf = Object.values(enfermeirosNoPosto);
  console.log("Quantidade ENFERMEIROS alocados no POSTO1 em 2026:", listEnf.length);
  listEnf.forEach(e => {
    const meses = [...e.meses].sort((a,b)=>a-b).map(m=>m.toString().padStart(2,"0")+"/2026").join(", ");
    console.log(" - "+e.nome+" | "+e.cat+" | meses: "+meses);
  });
}

// 4) Categorias TOTAIS nurses
console.log("\n=== Categorias TOTAIS no banco nurses (contagem): ===");
const cats = {};
nurses.forEach(n=>{ cats[n.category||"VAZIO"]=(cats[n.category||"VAZIO"]||0)+1; });
Object.keys(cats).sort().forEach(c=>console.log("  "+c+" = "+cats[c]));
