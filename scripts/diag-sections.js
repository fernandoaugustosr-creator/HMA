const fs=require("fs"),path=require("path");
const bkp="c:/Users/ferna/Documents/trae_projects/ENF-HMA/backup/backup_2026_08_21_18_59_41";
const sects=JSON.parse(fs.readFileSync(path.join(bkp,"sections.json"),"utf8"));
const rost=JSON.parse(fs.readFileSync(path.join(bkp,"monthly_rosters.json"),"utf8"));
const units=JSON.parse(fs.readFileSync(path.join(bkp,"units.json"),"utf8"));
const nurses=JSON.parse(fs.readFileSync(path.join(bkp,"nurses.json"),"utf8"));
const posto=units.find(u=>/POSTO 1/i.test(u.title));

console.log("schedule_sections TOTAL:", sects.length);
console.log("\n=== 20 primeiras sections (title, id): ===");
sects.slice(0,20).forEach(s=>console.log(" - id="+s.id+"  title=\""+(s.title||"")+"\"  unit_id="+(s.unit_id||"null")+"  order="+(s.list_order||s.order||"?")));

const sectsMes8=sects.filter(s=>{
  if (!posto) return false;
  return rost.some(r=>r.section_id===s.id && r.unit_id===posto.id && r.month===8 && r.year===2026);
});
console.log("\n=== Sections com roster AGOSTO/26 POSTO1: ===");
sectsMes8.forEach(s=>console.log(" - id="+s.id+" title=\""+s.title+"\""));

const sectsMes9=sects.filter(s=>{
  if (!posto) return false;
  return rost.some(r=>r.section_id===s.id && r.unit_id===posto.id && r.month===9 && r.year===2026);
});
console.log("\n=== Sections com roster SETEMBRO/26 POSTO1 (onde tem 6 ENFs): ===");
sectsMes9.forEach(s=>console.log(" - id="+s.id+" title=\""+s.title+"\""));

console.log("\n=== SETEMBRO POSTO1 por section + role: ===");
sectsMes9.forEach(s=>{
  const r9=rost.filter(r=>r.section_id===s.id && r.unit_id===posto.id && r.month===9 && r.year===2026);
  const uniq=new Set(r9.map(r=>r.nurse_id));
  const enfermeiros=[...uniq].map(id=>nurses.find(n=>n.id===id)).filter(n=>n && n.role==="ENFERMEIRO").map(n=>n.name.trim());
  const tecs=[...uniq].map(id=>nurses.find(n=>n.id===id)).filter(n=>n && n.role==="TECNICO").length;
  console.log("   ["+s.title+"]  ENFs="+enfermeiros.length+" ("+enfermeiros.slice(0,4).join("; ")+(enfermeiros.length>4?"...":"")+")   TECs="+tecs);
});

console.log("\n=== AGOSTO POSTO1 por section + role: ===");
sectsMes8.forEach(s=>{
  const r8=rost.filter(r=>r.section_id===s.id && r.unit_id===posto.id && r.month===8 && r.year===2026);
  const uniq=new Set(r8.map(r=>r.nurse_id));
  const enfermeiros=[...uniq].map(id=>nurses.find(n=>n.id===id)).filter(n=>n && n.role==="ENFERMEIRO").map(n=>n.name.trim());
  const tecs=[...uniq].map(id=>nurses.find(n=>n.id===id)).filter(n=>n && n.role==="TECNICO").length;
  console.log("   ["+s.title+"]  ENFs="+enfermeiros.length+" ("+enfermeiros.join("; ")+")   TECs="+tecs);
});
