const fs = require("fs");
const path = require("path");
const bkp = "c:/Users/ferna/Documents/trae_projects/ENF-HMA/backup/backup_2026_08_21_18_59_41";
const units = JSON.parse(fs.readFileSync(path.join(bkp,"units.json"),"utf8"));
const rost = JSON.parse(fs.readFileSync(path.join(bkp,"monthly_rosters.json"),"utf8"));
const nurses = JSON.parse(fs.readFileSync(path.join(bkp,"nurses.json"),"utf8"));

const posto = units.find(u => /POSTO 1/i.test(u.title));
if (!posto) { console.log("POSTO 1 NAO ENCONTRADO"); process.exit(0); }
console.log("POSTO 1 id:", posto.id);

// Contagem global nurses por role
console.log("\n=== nurses por ROLE: ===");
const roles = {};
nurses.forEach(n => { roles[n.role||"VAZIO"] = (roles[n.role||"VAZIO"]||0)+1; });
Object.keys(roles).forEach(r => console.log("  "+r+" = "+roles[r]));

// August 2026 - posto 1, por ROLE
console.log("\n=== Roster AGOSTO 2026 POSTO1 por ROLE: ===");
const rosters8 = rost.filter(r => r.unit_id===posto.id && r.year===2026 && r.month===8);
const byN8 = {};
rosters8.forEach(r => { byN8[r.nurse_id] = (byN8[r.nurse_id]||0)+1; });
const byRole = {};
Object.keys(byN8).forEach(nid => {
  const n = nurses.find(x=>x.id===nid);
  if (!n) return;
  byRole[n.role||"VAZIO"] = byRole[n.role||"VAZIO"] || [];
  byRole[n.role||"VAZIO"].push({ nome:n.name, coren:n.coren, vinculo:n.vinculo });
});
Object.keys(byRole).forEach(r => {
  console.log("\n  ROLE ["+r+"] = "+byRole[r].length+" pessoas:");
  byRole[r].sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(x => console.log("   - "+x.nome+" (coren:"+x.coren+" vínc:"+x.vinculo+")"));
});

// Todos os meses do ano, por role no POSTO 1
console.log("\n=== Por MES (2026, POSTO 1): count ENFERMEIRO | TECNICO: ===");
for (let m=1;m<=9;m++){
  const rMes = rost.filter(r => r.unit_id===posto.id && r.year===2026 && r.month===m);
  const seen=new Set(); let enf=0, tec=0, outros=0;
  rMes.forEach(r => {
    if (seen.has(r.nurse_id)) return;
    seen.add(r.nurse_id);
    const n = nurses.find(x=>x.id===r.nurse_id);
    if (!n) return;
    if ((n.role||"")==="ENFERMEIRO") enf++;
    else if ((n.role||"")==="TECNICO") tec++;
    else outros++;
  });
  console.log("   mes "+m.toString().padStart(2,"0")+": ENF="+enf+"  TEC="+tec+"  outros="+outros);
}

// Todos enfermeiros no banco, veja quais setores/meses eles aparecem
console.log("\n=== 10 primeiros ENFERMEIROS do banco: onde estao alocados em 2026? ===");
const enfermeiros = nurses.filter(n => (n.role||"")==="ENFERMEIRO");
console.log("Total enfermeiros no banco nurses:", enfermeiros.length);
enfermeiros.slice(0,10).forEach(n => {
  const aloc = rost.filter(r => r.nurse_id===n.id && r.year===2026).map(r => {
    const u = units.find(x=>x.id===r.unit_id);
    return (u?title:"setor???")+" "+r.month.toString().padStart(2,"0")+"/"+r.year;
  });
  const alocSet = [...new Set(aloc)].sort();
  console.log(" - "+n.name+" | alocado em: "+(alocSet.length? alocSet.join(" ; ") : "NENHUM 2026"));
});
