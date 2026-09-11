// Script para ATUALIZAR nurses (email, endereço, cidade, número) no SUPABASE e Modo Local
// Data: 11/09/2026
// Match prioritário por CPF normalizado (sem pontos/traços/espacos)
// Match fallback por NOME normalizado (sem acentos, uppercase, trim)
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://umvjzgurzkldqyxzkkaq.supabase.co'
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtdmp6Z3VyemtsZHF5eHpra2FxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY2MDE5MCwiZXhwIjoyMDgzMjM2MTkwfQ.1c-Yr0SKy95SkfuEYqfYP3NpZR-sEIi9pb1t0v09Gr0'

// ==========================================
// DADOS DA PLANILHA (colunas separadas por TAB)
// ==========================================
// Formato de cada linha: NOME \t CPF \t ENDEREÇO/RUA \t NÚMERO \t CIDADE \t? EMAIL (opcional)
const RAW_PLANILHA = `Michele Marinho Linhares \t026.995.603-40 \tRua da paz, Lagoa Verde. \t10\tImperatriz \t
Ledaiane Gonçalves Pinheiro \t01309588325\tRua Santa Rita  Bairro Santa Rita \t275\tImperatriz\t
Pávyla Lima Cunha \t60557391350\tRua projetada c, bacuri \t08\tImperatriz \t
Noeci Feijó Glapinski Zacca \t48730629004\tRua dos bem-te-vis \tSn\tImperatriz \t
Michele Marinho Linhares \t026.995.603-40 \tRua da paz, Lagoa Verde .\t10\tImperatriz MA\t
Serginho Matias da Silva \t03761776322\tTravessa Lucena \t24\tAçailândia \t
Fabíola Silva Vieira de Araújo \t02288984392\tRua dos bentivis, Cond monte Pascoal, apt 301, Renascenca 2\t266\tSão Luís, maranhao\t
José Carlos Pinto Viana \t05509617390\tRua Nossa Senhora Aparecida q16 c25 \tQuadra 16 casa 25 \tAçailândia Maranhão \t
Michele Marinho Linhares \t026.995.603-40 \tRua da paz, Lagoa Verde. \t10\tImperatriz MA \t
Lusirene Oliveira dos Santos \t33718431300\tRua metropolitana quadra 09 \t15\tAçailândia Maranhão \t
FERNANDO DA SILVA COSTA\t04456634308\tRUA CRICIUMA,QD 14, LT 10, RESIDENCIAL JOÃO PAULO II\t10\tAÇAILÂNDIA-MA\t
MARIA LEDA DIAS DOS SANTOS SOUZA\t72780568372\trua boa vista-  Vila capeloza\t224\tAçailândia\t
Marcela Cristina Oliveira Silva \t04656185370\tRua 42 casa 18 quadra 17 \tJardim Aulidia \tAçailândia \t
Delcy moraesh da silva\t91618371304\tRua ubarno santo centro \t215\tImperatriz  Ma \t
Daniela Magalhães Silva \t05621529383\tColinas park \t08\tAçailândia \t
Eunice vitória lima de sousa \t61390057364\tRua Manoel Eusébio da Costa \t4\tAçailândia \t
Rejane Lopes de carvalho \t69641625349\tRua E \t13 - PQ Indepencia\tImperatriz\t
Lindalva Alves Soares \t832.579.423-20\tRua 29\t04\tImperatriz Maranhão \t
Cristiane Nogueira dos Santos \t00988484374\tRua São Tomé quadra 80 \t50\tImperatriz \t
Kacilandia de Sá gaspar\t91152658387\tRua transversal 2, Q16,lote 25, colina park\t25\tImperatriz \t
Valdirene de Oliveira da Silva \t26523426300\tRua Marechal Deodoro da Fonseca \t154\tAçailândia \t
Hidário Teixeira Lima\t05791826303\tRua Argentina, 20 - Jardim América\t20\tImperatriz - MA\t
Teresinha Maria De Carvalho \t412 997 363 00\tRua João Lisboa \t488\tImperatriz \t
Fernanda Fernandes da Silva \t00629259380\tRua 2 quadra 1\t7\tAçailândia ma \t
Rutiely Marques Silva Barros \t06503840322\tRadial norte. Nova Açailandia 2\tQ:25 L:06A\tAçailandia Má \t
Josélia de Fátima Ataydes \t33363870353\tRua Pau Darco, qd 65  Lote 1N, Ouro Verde \tS/n\tAçailândia/Ma\t
Carleane da Silva Oliveira Mendes \t60253890390\tRua pindorama \t153\tBom Jesus das selvas \t
Neuzirene dos Reis Ribeiro Moura \t80504175300\tRua Tancredo Neves \t929\tImperatriz \t
FRANCILDO GUEDES SILVA \t03698188309\tRua Uruguai, jacu \t177\tAçailândia Maranhão \t
Antonia Ferreira lima\t34492356304\tRua Sousa lima \t48\tImperatriz-MA \t
Werlice Silva de brito\t91581206372\tRua Manaus \t638\tImperatriz \tWerlicesilva@icloud.com
RAYNEYDY CARVALHO DE OLIVEIRA DANTAS \t022.051.913-73 \tRua Dom Pedro \t3\tImperatriz \tRayneydy@outlook.com
Erisvaldo Junior de sousa sobrinho \t62869557396\tVila bom jardim quadra 15 casa 04 rua newton\t04\tAçailândia-Ma\terissjunior4@gmail.com
Ingrid Noleto Teixeira \t04953564332\tRua São Francisco, n.886. Centro, Açailândia - MA.\t886\tAçailândia \tingridnoletto@gmail.com
Roberto Barros Silva \t01165729300\tRua 11 quadra 11 casa 9\t9\tImperatriz \tenfermeirorobertobarros@hotmail.com 
Isabel santos de Oliveira \t99595753300\tAvenida dr Fiquene povoado união \t243\tSão Francisco do Brejão \tisa.enf.tec@gmail.com
Silene Maria da Silva Marinho \t34411461315\tRua Gonçalves Dias \t354\tDavinópolis\tsilenemarinho71@gmail.com
Jardel Rodrigues Castro\t61281811394\tRua Para\t121\tAçailândia \tcastrojardel28@gmail.com
Elizângela Pereira Campos \t60284685330\tRua 52 q 55 Lt 19\t19\tAcailandia \telisangelaperreira40@gmail.com
Luzineide Silva Figueredo \t62413066349\tRua Bila Dutra bairro Boca da Mata \t596\tImperatriz \tluzifigueredoenf@hotmail.com
Francilea de Sousa Rodrigues \t86097539304\tRua São Raimundo \t411\tAçailândia\tfrancileia811@gmail.com
Joseana Fernandes dos Santos\t71834320330\trua das oliveiras casa 4 lote 20 vila ildemar \tcasa 4 lote 20 \tAçailândia \tjoseanasantos275@gmail.com
Maria do Carmo de Oliveira Brito \t62439687316\tRua das acassias bairro texeirinha\t26\tCidelandia\tmariadeolliveirabritoo200@gmail.com
Jakeline Araújo Ribeiro \t04574213396\tRua Zezilândia \t907\tCidelândia\tjakearaujo2012@hotmail.com
DAYANE MELO DE OLIVEIRA \t60198827300\trua 15 de novembro  bairro :.vila primo \tsem número\tburiticupu \t853622dayane@gmail.com
Raquel Lima Ramos\t62431500381\t"Rua São Sebastião Q18 L01
Pequia "\t01\tAçailândia \tlimaramos631@gmail.com
Suely Pereira silva \t01552364313\tRua Zulmira logrado \t25\tImperatriz \tSuelysilva2330@gmail.com
Maria Caroliny da Costa Santos\t61957761300\tQuadra 104 \t250\tAçailândia \tmariacsantos1798@icloud.com
Nadine da Silva Melo \t60443900396\tRua Mogno \tQd 19 lt 09\tAçailândia \tnadine.emis@hotmail.com
Maria Edna Fernandes de Oliveira \t71546839372\tRua do Hospital Velho \t264\tBuriticupu casa\tmariaednafernandesdeoliveirafe@gmail.com
Jessica parreao dos santos \t06260068301\tRua sucupira Q84 l10  nova acailandia 2\tQ 84 l10\tAcailandia \tJessica991079377@gmail.com
Midiã Ximendes de Carvalho \t89492137372\tavenida Bernardo Sayão \t2020\tCidelândia \tmidiaximendes01@gmail.com
Thailson do Espirito Santo Mesquita \t05610950350\tRua São Raimundo \t566\tAçailândia \tthailson.santos4@outlook.com
Israele glabiane Gomes bandeira \t05735079379\tRua projetada parque Santa Lúcia \t36\tImperatriz \tbryanjheferson9@gmail.com
Julia Saraiva De Almeida\t05576546377\tQd 32 lt 21  colinas Park \tRua local 11\tAcailandia \tjusaraiva41@gmail.com
Luciana vieira da silva\t98947176320\tAvenida adelino andrade quadra 07\t01 ouro verde\tAcailandia\tlucianavieira342019@gmail.com
Maria da Conceição \t018.346.513-01 \tRua Um \t09\tImperatriz \tDaconceicao2210@gmail.com
Chyrlalya Raul Almeida Carvalho \t015.780.323-69 \tRua trinta e nove \t19\tImperatriz -MA\tChyrlalya@gmail.com
Edeilson José alencar de sousa\t01371688370\tRua sousa lima \t660\tImperatriz \tAlencaredeilson@gmail.com
Janaína Maria Dos Santos Lima \t00333442210\tRua A10 Qd-16 Lt- 48\t10\tAçailandia-MA\tjaninhasantosholanda@gmail.com
Maria Beatriz Bezerra de Oliveira \t008.781.793-48\tRua Bacabeira\tQ20 Casa 1 C\tAçailândia \tbia.b.oliver@gmail.com
Irenilde vieira rocha Cardoso \t34435948320\tRua f Qda 16 \tCasa 14\tImperatriz Maranhão \tirenilderocha2011@hotmail.com
Irenilde vieira rocha Cardoso \t34435948320\tRua f Qda 16 \tCasa 14\tImperatriz Maranhão \tirenilderocha2011@hotmail.com
Olyglelma joany Santana souza \t012.394.883-51 \tRua esmeralda \t339\tAcailandia\tOlyglelmaj@gmail.com
Amanda Santos\t04827567301\tAvenida imperatriz \t18\tImperatriz \tenfermeiraamanda2019@gmail.com
Enola Storch de Oliveira Martins\t01868328260\tRua barão do Rio Branco \t1920\tImperatriz\tenolastorch@gmail.com
Fabiana Mesauita\t95630805649\tRua Copacabana \t25 conjunto cartie \tImperatriz \tfabianamesquitav@gmail.com
Ana souza lima\t46826963272\tRua José Francisco de Parma \t10\tImperatriz/Ma\tlyyma2007@gmail.com
Maria Luciene Silva Sousa \t57119783300\tRua São José \t321\tAçailândia\tluciennesilvasousa@gmail.com
Rita de Cássia Oliveira Lima \t13853910300\tAv.Circular Atlântico Sul \t108\tImperatriz MA\tr41831509@gmail.com
Tatiane Santos de Sousa \t832.769.713-72 \tRua Antônio Miranda \tN1\tImperatriz \tTati.itzsantos@gmail.com
Solange Francisca Pereira da Silva Olanda \t94696888304\tRua Dom Pedro primeiro \t14 jacú \tAçailândia \tSolalycia2009@gmail.com
Hidaianny Hantheska Lima Santos \t61073603369\tQ 196 \t307\tAçailândia-MA/ Vila Ildemar \thidaiannylima@gmail.com
Irandir  Alves  dos  Santos \t008.186.923-16 \tRua angelin vila dos  professores \tRua  angelin  n 16 vila dos professores   \tBuriticupu \tIrandiralves2010@hotmil.com
Leniclea Maciel Mota \t40277666368\tRua Jarana Qd 74 Lote 07\tBairro Nova Açailândia 2\tAçailândia \tlene.clea@Gmail.com
Maria de Jesus da Silva Andrade \t57700117349\tRua 15 Qd 25\tlote 23 Valle do açaí \tAçailândia \tmariadasilva67g@gmail.com
Jovenilia Barbosa Lima\t86421344372\tRua herminio Santos \t232\tDavinópolis \tjovenilhabarbosa@gmail.com
Maria Edna Fernandes de Oliveira\t71546839372\tRua do hospital velho\t264\tBuriticupu - MA\tmariaednafernandesdeoliveiraf@gmail.com
Demetrius Costa Coelho \t73396265300\tRua Dom Pedro ll \t206b\tAçailândia \tdemetriuscostacoellho08@gmail.com
Jailcicleia dos Santos Conceição \t02469787327\tRua bandeirante\t110\tSenador lá rocque\tjailcicleia.tcc@gmail.com
Eva do Nascimento Rodrigues \t60381705374\tRua 59 Quadra 56 \tCasa 22\tAçailândia \tEvanascimento16@icloud.com
Maycon Dolglas Pereira dos Santos \t06026458166\tRua 12 , setor Jardim de Alah \t56\tAçailândia Maranhão \tmaiconp943@gmail.com
Quitéria Gomes Forted\t92697305300\tR. Dom Pedro I \t299\tAçailandia \tqteriafortes@gmail.com
Irlania pereira de Aguiar \t39431444291\tRua 06\tQd 15 Lot 04\tAçailândia \tirlaniapaguiar@gmail.com
Priscila Henriqueta Oliveira Desterro \t01051275318\tRua São Lucas, quadra 22, Residencial Tropical\t27\tAçailandia\tpdesterro22@gmail.com
Maycon Douglas mendes ibiapino\t052.438.993-48 \tRua Dom moto \t633\tBuriticupu \tMaycontjulia@gmail.com
VANESSA TORRES CIRINO \t047.401.273-50 \tRua Rio Grande , Apartamento Lumière\t96\tAÇAILANDIA \tvanessatorres.enf@hotmail.com
Valdizia da silva leal\t91630231304\tRua dos pombos , \t01 B , CASA B\tImperatriz/MA\tvaldizialeal@hotmail.com
Cheila ferreira Abreu \t37009753253\tRua topázio casa 06, residencial por do sol .\t06\tImperatriz,MA\tcheilaferreira.linda@gmail.com
Leidiany Carvalho Bomjardim Oliveira \t01686821336\tRua Local 23, Quadra 55, Lote 13-L, Colinas Park \t13-L\tAçailândia \tbomjardimleidiany@gmail.com
Nilson Ribeiro da Silva filho \t93678118372\tRua nossa senhora de Fátima  Bairro Capeloza\t306\tAçailândia \tdasilva.nil.2011@gmail.com
Cleize Ediani Silva dos Santos\t394.374.182.68\tRua da Paz\t500\tCond. Canto dos Pássaros, casa 21.\tcleizeediani@gmail.com
Vitor Pachelle Lima Abreu \t00401354202\tRua João de Deus \tA/N\tAçailândia \tvpachelle@gmail.com
Edivaldo Silva Pinheiro \t04086536390\tRua d, 53 Santa Rita \t53\tImperatriz \tenf.edivaldo.p@gmail.com 
Ita Alana Nascimento Teixeira\t05138571338\tAvenida Bayma Júnior, Condomínio Village jardins 2, bairro bom Jesus\tQuase 6 casa 9\tImperatriz \titaalanan@gmail.com`

// ==========================
// Helpers
// ==========================
function normalizeCpf(c) {
  if (!c) return ''
  return String(c).replace(/[^0-9]/g, '').trim().padStart(11, '0')
}

function normalizeName(n) {
  if (!n) return ''
  return String(n)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tira acentos
    .replace(/[^a-z\s]/g, ' ') // só letras e espaços
    .split(/\s+/).filter(Boolean).join(' ') // trim e múltiplos espaços
}

function trimClean(v) { return String(v || '').replace(/\s+/g, ' ').trim() }

function parsePlanilha(raw) {
  // Split por linhas, depois por TAB
  const linhas = raw.split(/\r?\n/).map(l => l.replace(/\t+$/,'')).filter(Boolean)
  const parsed = []
  for (const linha of linhas) {
    const parts = linha.split('\t').map(s => trimClean(s.replace(/\u00a0/g,' ')))
    // Esperado 5 ou 6 colunas: [nome, cpf, address, house_number, city, email?]
    while (parts.length < 5) parts.push('')
    // Se tem mais de 6, junta o excedente no address (ruas com vírgula/aspas)
    if (parts.length > 6) {
      const excedente = parts.slice(5, parts.length - 1)
      parts[2] = [parts[2], ...excedente].join(' ')
      parts[5] = parts[parts.length - 1]
      parts.length = 6
    }
    let [name, cpf, address, house_number, city, email=''] = parts
    // Caso 5 colunas E email colocado em city (se city tem @) -> arruma
    if (!email && city && /@/.test(city)) {
      email = city; city = house_number; house_number = ''
    }
    parsed.push({
      raw: linha,
      name: trimClean(name),
      cpfRaw: trimClean(cpf),
      cpf: normalizeCpf(cpf),
      address: trimClean(address),
      house_number: trimClean(house_number),
      city: trimClean(city),
      email: trimClean(email),
    })
  }
  return parsed
}

// Deduplica a planilha antes do match (ex: Michele Marinho Linhares, Irenilde... repetidos)
function dedupePlanilha(arr) {
  const byCpf = new Map()
  const noCpf = []
  for (const r of arr) {
    const isEmailGood = !!r.email && /@/.test(r.email)
    const isDataRich = (r.address?.length >= 4 ? 2 : 0) + (r.city ? 1 : 0) + (isEmailGood ? 3 : 0) + (r.house_number ? 1 : 0)
    const enriched = { ...r, _score: isDataRich }
    if (r.cpf && r.cpf.replace(/0/g,'').length > 0) {
      if (!byCpf.has(r.cpf)) byCpf.set(r.cpf, enriched)
      else {
        const prev = byCpf.get(r.cpf)
        if (enriched._score > prev._score || (!prev.email && enriched.email)) {
          byCpf.set(r.cpf, enriched)
        }
      }
    } else {
      noCpf.push(enriched)
    }
  }
  const result = Array.from(byCpf.values())
  // Agrupa por nome normalizado (sem CPF ou p/ completar info)
  const byNormName = new Map()
  for (const r of [...result, ...noCpf]) {
    const nk = normalizeName(r.name)
    if (!nk) continue
    if (!byNormName.has(nk)) byNormName.set(nk, r)
    else {
      const prev = byNormName.get(nk)
      const prevScore = prev._score || 0
      const curScore = r._score || 0
      const merged = {
        ...prev,
        name: r.name || prev.name,
        cpf: r.cpf || prev.cpf,
        cpfRaw: r.cpfRaw || prev.cpfRaw,
        email: r.email || prev.email,
        address: r.address?.length > (prev.address?.length || 0) ? r.address : prev.address,
        house_number: r.house_number || prev.house_number,
        city: r.city || prev.city,
        _score: Math.max(prevScore, curScore) + ((r.email && !prev.email) ? 3 : 0),
      }
      byNormName.set(nk, merged)
    }
  }
  return Array.from(byNormName.values())
}

// ==========================================
// EXECUÇÃO
// ==========================================
async function main() {
  console.log('\n========================================')
  console.log('SCRIPT ATUALIZAÇÃO CADASTRO NURSES (Endereço/Cidade/Email)')
  console.log('========================================\n')

  const planilhaBruta = parsePlanilha(RAW_PLANILHA)
  const records = dedupePlanilha(planilhaBruta)
  console.log(`[1] Planilha original: ${planilhaBruta.length} linhas`)
  console.log(`[1] Após deduplicação (CPF + nome normalizado): ${records.length} registros únicos\n`)

  // --- SUPABASE ---
  // Usa apenas fetch REST + service_role (não precisa de @supabase/supabase-js instalado)
  console.log('[2] Conectando SUPABASE via REST API (service_role key)...')
  let supabaseOk = false

  // Helper REST Supabase (evita instalar dependência)
  const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
  async function sbGet(url) {
    const r = await fetch(SUPABASE_REST + url, { headers })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`GET ${url} → ${r.status}: ${JSON.stringify(data)}`)
    return data
  }
  async function sbPatch(url, body) {
    const r = await fetch(SUPABASE_REST + url, {
      method: 'PATCH', headers, body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`PATCH ${url} → ${r.status}: ${JSON.stringify(data)}`)
    return data
  }

  // --- 1) Listar todos nurses do Supabase ---
  console.log('[3] Baixando nurses do Supabase (tabela nurses)...')
  let nursesSupabase = []
  try {
    nursesSupabase = await sbGet('/nurses?select=id,name,cpf,email,address,house_number,city&order=id')
    console.log(`    → OK. ${nursesSupabase.length} nurses no banco.\n`)
    supabaseOk = true
  } catch (e) {
    console.log(`    → ERRO ao buscar nurses: ${e.message}\n`)
  }

  // --- 2) Indexar nurses por CPF e nome ---
  const idxCpf = new Map() // cpfNormalizado -> list<{ nurse idx}>
  const idxName = new Map() // nomeNormalizado -> list<{ nurse idx}>
  for (const n of nursesSupabase) {
    const c = normalizeCpf(n.cpf)
    if (c && c.replace(/0/g,'').length > 0) {
      if (!idxCpf.has(c)) idxCpf.set(c, [])
      idxCpf.get(c).push(n)
    }
    const nk = normalizeName(n.name)
    if (nk) {
      if (!idxName.has(nk)) idxName.set(nk, [])
      idxName.get(nk).push(n)
    }
  }

  console.log(`[4] Indexação: ${idxCpf.size} CPFs / ${idxName.size} nomes únicos.\n`)

  // --- 3) MATCH ---
  const stats = {
    totalRecords: records.length,
    foundByCpf: 0, foundByName: 0, notFound: 0, duplicateByCpf: 0, duplicateByName: 0,
    updatedInSupabase: 0, skippedNoChange: 0, supabaseUpdateErrors: 0,
  }
  const naoEncontrados = []
  const atualizados = []
  const duplicados = []

  const UPDATES_PER_EXECUTION = []

  for (const r of records) {
    let match = null
    let matchType = null
    let isDuplicate = false

    // Match A) CPF (prioridade)
    if (r.cpf && r.cpf.replace(/0/g,'').length > 0) {
      const lst = idxCpf.get(r.cpf)
      if (lst && lst.length === 1) { match = lst[0]; matchType = 'CPF' }
      else if (lst && lst.length > 1) {
        isDuplicate = true
        duplicados.push({ tipo: 'CPF_MULTIPLOS', cpf: r.cpf, nome_planilha: r.name, matches: lst.map(x=>`#${x.id} ${x.name}`) })
        // Apanha o primeiro
        match = lst[0]; matchType = 'CPF (DUPLICADO, peguei #1)'
      }
    }

    // Match B) Nome normalizado (fallback)
    if (!match) {
      const nk = normalizeName(r.name)
      const lst = idxName.get(nk)
      if (lst && lst.length === 1) { match = lst[0]; matchType = 'NOME' }
      else if (lst && lst.length > 1) {
        isDuplicate = true
        duplicados.push({ tipo: 'NOME_MULTIPLOS', nome: nk, matches: lst.map(x=>`#${x.id} ${x.name} | CPF:${normalizeCpf(x.cpf)}`) })
        match = lst[0]; matchType = 'NOME (DUPLICADO, peguei #1)'
      }
    }

    if (!match) {
      stats.notFound++
      naoEncontrados.push({ nome: r.name, cpf: r.cpfRaw || '(sem cpf)', cidade: r.city, email: r.email || '(sem email)' })
      continue
    }

    if (matchType === 'CPF') stats.foundByCpf++
    else if (matchType.startsWith('CPF')) { stats.foundByCpf++; stats.duplicateByCpf++ }
    else if (matchType === 'NOME') stats.foundByName++
    else if (matchType.startsWith('NOME')) { stats.foundByName++; stats.duplicateByName++ }

    // Comparar campos (atualiza SE HOUVER dado novo E o campo atual estiver vazio OU o dado for mais rico)
    const patch = {}
    const justificativas = []

    function decide(field, planValue, keyDb) {
      const dbValue = String(match[keyDb] || '').trim()
      const planV = String(planValue || '').trim()
      if (!planV) return
      const dbEmpty = !dbValue
      const planRicher = planV.length > Math.max(0, dbValue.length)
      const emailRule = (keyDb === 'email') ? (planV.includes('@') && !dbValue.includes('@')) : false
      if (dbEmpty || planRicher || emailRule) {
        patch[keyDb] = planV
        const how = dbEmpty ? '(vazio→preenchido)' : (planRicher ? '(mais rico)' : '')
        justificativas.push(`${field}: "${dbValue||''}" ${how} → "${planV}"`)
      }
    }
    decide('Endereço', r.address, 'address')
    decide('Número',   r.house_number, 'house_number')
    decide('Cidade',   r.city, 'city')
    decide('Email',    r.email, 'email')

    if (Object.keys(patch).length === 0) {
      stats.skippedNoChange++
      continue
    }

    UPDATES_PER_EXECUTION.push({
      id: match.id,
      name: match.name,
      matchType,
      patch,
      justificativas,
    })
  }

  console.log(`[5] MATCH concluído.`)
  console.log(`    - Encontrados por CPF: ${stats.foundByCpf} (duplicados CPF: ${stats.duplicateByCpf})`)
  console.log(`    - Encontrados por NOME: ${stats.foundByName} (duplicados NOME: ${stats.duplicateByName})`)
  console.log(`    - NÃO ENCONTRADOS:     ${stats.notFound} (de ${stats.totalRecords})`)
  console.log(`    - Sem alteração:       ${stats.skippedNoChange}`)
  console.log(`    - PENDENTES UPDATE:    ${UPDATES_PER_EXECUTION.length}\n`)

  // --- 4) Aplicar UPDATES no SUPABASE (batch) ---
  if (UPDATES_PER_EXECUTION.length > 0 && supabaseOk) {
    console.log(`[6] Aplicando ${UPDATES_PER_EXECUTION.length} updates no Supabase (REST PATCH /nurses)...`)
    for (const upd of UPDATES_PER_EXECUTION) {
      try {
        await sbPatch(`/nurses?id=eq.${encodeURIComponent(upd.id)}`, upd.patch)
        stats.updatedInSupabase++
        atualizados.push({
          id: upd.id, nome: upd.name, tipo_match: upd.matchType,
          alteracoes: upd.justificativas.join(' | '),
        })
      } catch (e) {
        stats.supabaseUpdateErrors++
        atualizados.push({
          id: upd.id, nome: upd.name, tipo_match: upd.matchType, ERRO: e.message,
        })
      }
    }
    console.log(`    → OK: ${stats.updatedInSupabase} atualizados | erros: ${stats.supabaseUpdateErrors}\n`)
  } else if (!supabaseOk) {
    console.log(`[6] SKIPPED updates Supabase (falha conexão).\n`)
  } else {
    console.log(`[6] Nenhum update pendente.\n`)
  }

  // --- 5) Atualizar db.json LOCAL (backup antes) ---
  console.log('[7] Atualizando db.json (Modo Local)...')
  const dbPath = path.join(__dirname, '..', 'data', 'db.json')
  if (fs.existsSync(dbPath)) {
    const backupPath = path.join(__dirname, '..', 'data', `db.json.backup-${Date.now()}.json`)
    let localUpdates = 0
    try {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
      fs.writeFileSync(backupPath, JSON.stringify(db, null, 2))
      if (db.nurses && Array.isArray(db.nurses)) {
        const localIdxCpf = new Map()
        const localIdxName = new Map()
        for (const n of db.nurses) {
          const c = normalizeCpf(n.cpf)
          if (c && c.replace(/0/g,'').length>0) localIdxCpf.set(c, n)
          const nk = normalizeName(n.name)
          if (nk) localIdxName.set(nk, n)
        }
        for (const r of records) {
          let match = localIdxCpf.get(r.cpf)
          if (!match) match = localIdxName.get(normalizeName(r.name))
          if (!match) continue
          let changed = false
          if (r.address && !match.address) { match.address = r.address; changed = true }
          if (r.house_number && !match.house_number) { match.house_number = r.house_number; changed = true }
          if (r.city && !match.city) { match.city = r.city; changed = true }
          if (r.email && /@/.test(r.email) && (!match.email || !/@/.test(match.email))) { match.email = r.email; changed = true }
          if (changed) localUpdates++
        }
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))
      }
      console.log(`    → Backup criado: ${path.basename(backupPath)}`)
      console.log(`    → nurses atualizados (local): ${localUpdates}`)
    } catch (e) {
      console.log(`    → ERRO db.json: ${e.message}`)
    }
  } else {
    console.log(`    → db.json não encontrado em ${dbPath} (pulado)`)
  }

  // --- 6) SALVAR RELATÓRIO em CSV + Markdown ---
  const outDir = __dirname
  const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)

  // CSV ATUALIZADOS
  const csvAtual = [
    ['ID','NOME','TIPO_MATCH','ALTERACOES'],
    ...atualizados.map(a => [String(a.id), a.nome, a.tipo_match, (a.ERRO ? ('ERRO: ' + a.ERRO) : a.alteracoes)])
  ].map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
  fs.writeFileSync(path.join(outDir, `atualizados-nurses-${ts}.csv`), '\ufeff' + csvAtual, 'utf8')

  // CSV NÃO ENCONTRADOS
  const csvNao = [
    ['NOME','CPF_PLANILHA','CIDADE_PLANILHA','EMAIL_PLANILHA'],
    ...naoEncontrados.map(n => [n.nome, n.cpf, n.cidade, n.email])
  ].map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
  fs.writeFileSync(path.join(outDir, `nao-encontrados-nurses-${ts}.csv`), '\ufeff' + csvNao, 'utf8')

  // CSV DUPLICADOS
  const csvDup = [
    ['TIPO','CHAVE','NOME_PLANILHA','MATCHES'],
    ...duplicados.map(d => [d.tipo, d.cpf || d.nome || '', d.nome_planilha || d.nome || '', d.matches.join(' || ')])
  ].map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n')
  fs.writeFileSync(path.join(outDir, `duplicados-nurses-${ts}.csv`), '\ufeff' + csvDup, 'utf8')

  const md = `# RELATÓRIO ATUALIZAÇÃO NURSES (${ts})

## ESTATÍSTICAS GERAIS
\`\`\`
Total de registros únicos na planilha:   ${stats.totalRecords}
Total nurses no Supabase:                ${nursesSupabase.length}
Encontrados por CPF (1ª prioridade):     ${stats.foundByCpf}   (duplicados no banco: ${stats.duplicateByCpf})
Encontrados por NOME (fallback):         ${stats.foundByName}  (duplicados no banco: ${stats.duplicateByName})
──────────────────────────────────────────────────────
NÃO ENCONTRADOS no banco:                ${stats.notFound}
Sem alteração (campos já ok):            ${stats.skippedNoChange}
ATUALIZADOS no SUPABASE:                 ${stats.updatedInSupabase}
Erros update Supabase:                   ${stats.supabaseUpdateErrors}
\`\`\`

## NÃO ENCONTRADOS (cadastrar manualmente ou corrigir CPF/nome)
Total: ${naoEncontrados.length}
${naoEncontrados.map(n => `- ${n.nome} | CPF: ${n.cpf} | Cidade: ${n.cidade} | Email: ${n.email}`).join('\n')}

## DUPLICADOS no banco de dados (revisar)
Total: ${duplicados.length}
${duplicados.map(d => `- ${d.tipo}: chave=${d.cpf||d.nome} → matches=[${d.matches.join(' ; ')}]`).join('\n')}

## ATUALIZADOS (SUPABASE)
Total: ${atualizados.length}
${atualizados.slice(0,100).map(a => `- #${a.id} **${a.nome}** (match: ${a.tipo_match}) → ${a.ERRO ? '❌ '+a.ERRO : a.alteracoes}`).join('\n')}
`
  fs.writeFileSync(path.join(outDir, `relatorio-atualizacao-nurses-${ts}.md`), md, 'utf8')

  console.log('\n========================================')
  console.log('CONCLUÍDO. Arquivos de relatório salvos em .dbg/:')
  console.log(`  - atualizados-nurses-${ts}.csv`)
  console.log(`  - nao-encontrados-nurses-${ts}.csv`)
  console.log(`  - duplicados-nurses-${ts}.csv`)
  console.log(`  - relatorio-atualizacao-nurses-${ts}.md`)
  console.log('========================================')

  // Imprime resumo final
  console.log('\n📋 RESUMO:')
  console.log(`  ✅ ATUALIZADOS Supabase:    ${stats.updatedInSupabase}`)
  console.log(`  ⚠️  NÃO ENCONTRADOS:         ${stats.notFound} (ver CSV nao-encontrados)`)
  console.log(`  🧩 DUPLICADOS no banco:     ${duplicados.length} (ver CSV duplicados)`)
  console.log(`  ⏭  Sem alteração (já ok):   ${stats.skippedNoChange}\n`)
}

main().catch(e => { console.error('\n❌ ERRO FATAL:', e); process.exit(1) })
