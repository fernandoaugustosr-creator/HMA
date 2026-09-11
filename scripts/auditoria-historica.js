require('dotenv').config({path: '.env.local'});
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function ehEnfermeiro(n) {
  if (!n) return false;
  const r = String(n.role||'').toLowerCase();
  const v = String(n.vinculo||'').toLowerCase();
  if (n.crm && String(n.crm).trim()) return false;
  const temE = r.includes('enfermeir') || v.includes('enfermeir');
  const temT = r.includes('tecnic') || r.includes('auxiliar') || v.includes('tecnic') || v.includes('auxiliar');
  return temE && !temT;
}

(async () => {
  const ts = new Date().toISOString().replace(/[T:\.\-]/g,'_').slice(0,19);
  console.log('=== AUDITORIA HISTÓRICA: ENFERMEIROS, JAN/2025 a SET/2026, TODOS SETORES ===\n');
  console.log('Data do relatório:', new Date().toLocaleString('pt-BR'));
  console.log('-> Usando dados do BACKUP LOCAL (sem depender de rede/Supabase).\n');

  // Acha backup mais recente
  const backupDir = path.join(__dirname, '..', 'backup');
  const backups = fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter(d => d.startsWith('backup_')).sort().reverse() : [];
  if (backups.length === 0) { console.log('Nenhum backup encontrado em', backupDir, 'rode backup-completo.js primeiro'); return; }
  const bkpPath = path.join(backupDir, backups[0]);
  console.log('Usando backup:', backups[0]);

  const units   = JSON.parse(fs.readFileSync(path.join(bkpPath,'units.json'),'utf8'));
  const allNurses = JSON.parse(fs.readFileSync(path.join(bkpPath,'nurses.json'),'utf8'));
  const allRosters = JSON.parse(fs.readFileSync(path.join(bkpPath,'monthly_rosters.json'),'utf8'));
  // Shifts: junta 2025 e 2026
  const todosShifts = [];
  if (fs.existsSync(path.join(bkpPath,'shifts_2025.json'))) todosShifts.push(...JSON.parse(fs.readFileSync(path.join(bkpPath,'shifts_2025.json'),'utf8')));
  if (fs.existsSync(path.join(bkpPath,'shifts_2026.json'))) todosShifts.push(...JSON.parse(fs.readFileSync(path.join(bkpPath,'shifts_2026.json'),'utf8')));

  console.log('Units:', units.length, '| Nurses:', allNurses.length, '| Rosters:', allRosters.length, '| Shifts:', todosShifts.length);

  const umap = Object.fromEntries(units.map(u=>[u.id,u]));

  const meses = [];
  for (const ano of [2025, 2026]) {
    for (let m=1; m<= (ano===2026?9:12); m++) meses.push({ano, m, key: ano + '-' + String(m).padStart(2,'0')});
  }

  // organiza estruturas
  const porSetor = {};
  const porEnfermeiro = {};
  const rostInfo = {};
  const nmap = Object.fromEntries((allNurses||[]).map(n=>[n.id,n]));
  const enfermeirosIds = new Set((allNurses||[]).filter(ehEnfermeiro).map(n=>n.id));
  console.log('Enfermeiros identificados:', enfermeirosIds.size);

  (allRosters||[]).forEach(r => {
    const n = nmap[r.nurse_id];
    if (!n) return;
    const eh = ehEnfermeiro(n);
    if (!eh) return;
    const key = (r.year||0) + '-' + String(r.month||0).padStart(2,'0');
    const uid = r.unit_id || 'NULO';
    rostInfo[r.id] = { uid, key };
    if (!porSetor[uid]) porSetor[uid] = {};
    if (!porSetor[uid][key]) porSetor[uid][key] = {rost: new Set(), nomes: new Set(), setor: (umap[uid]?.title||'NULO')};
    porSetor[uid][key].rost.add(r.id);
    porSetor[uid][key].nomes.add(n.name);
    if (!porEnfermeiro[r.nurse_id]) porEnfermeiro[r.nurse_id] = { name: n.name, role: n.role, vinc: n.vinculo, meses: {} };
    porEnfermeiro[r.nurse_id].meses[key] = { uid, setor: umap[uid]?.title || '???' };
  });

  // Shifts de enfermeiros
  const shiftsPorSetorMes = {};
  todosShifts.forEach(s => {
    if (!enfermeirosIds.has(s.nurse_id)) return;
    let uid = null, key = null;
    if (s.roster_id && rostInfo[s.roster_id]) {
      uid = rostInfo[s.roster_id].uid;
      key = rostInfo[s.roster_id].key;
    } else {
      // Orfão: infere mes a partir de date
      const parts = s.date.slice(0,7).split('-');
      if (!parts) return;
      key = parts[0] + '-' + parts[1];
      uid = 'NULO';
    }
    const k = uid + '#' + key;
    shiftsPorSetorMes[k] = (shiftsPorSetorMes[k]||0)+1;
  });

  // Imprime tabela por setor
  console.log('\n\n============== TABELA POR SETOR (ENFERMEIROS ALOCADOS) ==============\n');
  console.log('Setor'.padEnd(52), meses.map(m=>String(m.key).padEnd(7)).join(''));
  console.log('-'.repeat(52 + meses.length*7));

  // Filtra setores que tiveram ENF algum mes
  const setoresComENF = Object.entries(porSetor)
    .filter(([uid, meses]) => Object.keys(meses).some(k => meses[k]?.nomes.size>0))
    .map(([uid, meses]) => ({
      uid, title: umap[uid]?.title || '???',
      maxMeses: meses
    }));

  // Ordena setores por title
  setoresComENF.sort((a,b)=>a.title.localeCompare(b.title, 'pt-BR'));
  // Tambem inclui setores vazios que voce espera ter enfermeiros
  const obrigatorios = units.filter(u => /ENFERMEIR|UTI.*ENF|NIR|RISCO|RELIG|CPN/i.test(u.title));
  obrigatorios.forEach(u => {
    if (!setoresComENF.find(x => x.uid === u.id)) setoresComENF.push({uid: u.id, title: u.title, maxMeses: porSetor[u.id] || {}});
  });

  const setorLinhas = [];
  setoresComENF.forEach(s => {
    const vals = meses.map(m => {
      const info = (porSetor[s.uid]||{})[m.key];
      if (!info) return ' .   ';
      const r = info.rost.size;
      const sh = shiftsPorSetorMes[s.uid + '#' + m.key] || 0;
      return String(r).padStart(2)+(sh>0?('/'+String(sh)).padEnd(4):'/  '.padEnd(4));
    });
    setorLinhas.push({t: s.title, v: vals, uid: s.uid});
  });

  setorLinhas.forEach(l => {
    console.log(String(l.t).padEnd(52).substring(0,52) + ' ' + l.v.join(' '));
  });

  console.log('\n  Legenda: cada celula = "ENFs_alocados/quantidade_shifts"  (. = nada, 0/0 = liberado vazio, c/dados = c/ENFs)');

  // Enfermeiros que SUMIRAM em algum mes (tinham em mes anterior e pararam no proximo)
  console.log('\n\n============== ENFERMEIROS QUE SUMIRAM (alocavam em mes M e em M+1 nao tem nada) ==============\n');
  const casosSumico = [];
  Object.entries(porEnfermeiro).forEach(([nid, info]) => {
    const mesAtivos = meses.filter(m => info.meses[m.key]);
    if (mesAtivos.length === 0) return;
    const ultimo = mesAtivos[mesAtivos.length-1];
    const idx = meses.indexOf(ultimo);
    if (idx >= 0 && idx < meses.length-1 && meses[meses.length-1].key !== ultimo.key) {
      // Verifica se tem algum mes SEM nada DEPOIS dele até setembro/2026 (nao eh so o usuario nao ter chegado ainda)
      const temDepois = meses.slice(idx+1).some(m => info.meses[m.key]);
      if (!temDepois) {
        casosSumico.push({nome: info.name, role: info.role, vinc: info.vinc, ultimo: ultimo.key, ultimoSetor: info.meses[ultimo.key].setor});
      }
    }
  });
  casosSumico.sort((a,b)=> (a.ultimo>b.ultimo?1:-1));
  console.log('Total de enfermeiros que "pararam de aparecer" apos um mes e nao voltaram ate set/2026:', casosSumico.length);
  console.log('');
  casosSumico.slice(0, 40).forEach((c,i) => {
    console.log(String(i+1).padStart(3)+'. ' + String(c.nome).padEnd(42).substring(0,42) +
      ' | Ult. aloc.: ' + c.ultimo + ' em ' + String(c.ultimoSetor).padEnd(35).substring(0,35) +
      ' | Role=' + c.role + ' Vinc=' + c.vinc);
  });

  // Exporta CSV dos casos
  const csvLinhas = ['nome;role;vinculo;ultimo_mes_alocado;ultimo_setor'];
  casosSumico.forEach(c => csvLinhas.push([c.nome, c.role||'', c.vinc||'', c.ultimo, c.ultimoSetor].map(x=>('"'+(x||'').replace(/"/g,'""')+'"')).join(';')));
  const csvFile = path.join(__dirname, '..', 'backup', 'relatorio_enfermeiros_sumidos_'+ts+'.csv');
  fs.mkdirSync(path.dirname(csvFile), {recursive: true});
  fs.writeFileSync(csvFile, csvLinhas.join('\r\n'), 'utf8');
  console.log('\nCSV salvo em:', csvFile);

  // Total resumo por mes
  console.log('\n\n============== RESUMO TOTAL POR MÊS (todos setores) ==============\n');
  console.log('  Mês    | Qtd ENFs alocados (mesmo em múltiplos setores = 1 contagem distinta) | Qtd plantões de ENF');
  const totalPorMes = {};
  meses.forEach(m => { totalPorMes[m.key] = {enf: new Set(), shifts: 0}; });
  Object.entries(porEnfermeiro).forEach(([nid, info]) => {
    Object.entries(info.meses).forEach(([k,v]) => { if (totalPorMes[k]) totalPorMes[k].enf.add(nid); });
  });
  Object.entries(shiftsPorSetorMes).forEach(([k, cnt]) => {
    const [uid, mk] = k.split('#');
    if (totalPorMes[mk]) totalPorMes[mk].shifts += cnt;
  });
  meses.forEach(m => {
    console.log('  ' + m.key + ' | ' + String(totalPorMes[m.key].enf.size).padStart(5) + ' enfermeiros distintos | ' + String(totalPorMes[m.key].shifts).padStart(6) + ' plantões');
  });

})();
