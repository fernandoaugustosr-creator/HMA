/*
CADASTRAR 100 FRASES MOTIVACIONAIS NOVAS (USUARIO 22/09/2026)
USO: node .dbg/cadastrar-100-frases-motivacionais.js
FAZ:
  (1) Modo Local: substitui data/db.json motivational_phrases_v1 -> V2 100 frases novas
  (2) Supabase REAL: app_settings key motivational_phrases_v1 value = JSON array 100 frases
      e zera a flag motivational_phrases_v1_seeded (o sistema auto-puxa na proxima tela? Não, SCRIPT SOBRESCREVE DIRETO)
OBS: Se rodar 2x -> NÃO duplica, sempre substitui pela lista oficial (100).
*/
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')

const FRASES_100 = [
  "Gestão eficiente transforma desafios em oportunidades de cuidar melhor.",
  "Gerir um hospital é cuidar de pessoas, processos e propósitos.",
  "Uma boa gestão começa com uma equipe que acredita no que faz.",
  "Planejar hoje é preparar o hospital para cuidar melhor amanhã.",
  "Gestão com propósito gera resultados que fazem a diferença.",
  "Cada decisão na gestão deve ter como foco a qualidade do cuidado.",
  "Liderar é transformar responsabilidade em compromisso.",
  "Gestão hospitalar é equilíbrio entre estratégia, pessoas e cuidado.",
  "Quando a gestão organiza, a equipe consegue cuidar melhor.",
  "Grandes resultados começam com pequenas melhorias todos os dias.",
  "Gestão humanizada fortalece equipes e melhora resultados.",
  "Administrar é organizar recursos; liderar é inspirar pessoas.",
  "Uma gestão forte nasce de processos bem definidos e pessoas valorizadas.",
  "O sucesso de um hospital é construído por muitas mãos.",
  "Gestão eficiente é aquela que transforma planejamento em cuidado.",
  "Onde existe organização, existe mais espaço para cuidar.",
  "Liderança não é apenas decidir; é assumir responsabilidades.",
  "Cada processo bem conduzido contribui para um atendimento melhor.",
  "A excelência hospitalar começa na gestão e chega ao paciente.",
  "Gestão é fazer acontecer, mesmo diante dos desafios.",
  "Uma equipe unida transforma dificuldades em soluções.",
  "Cuidar é um trabalho de equipe.",
  "Nenhum grande resultado é construído sozinho.",
  "Quando cada profissional faz sua parte, o cuidado se torna maior.",
  "Uma equipe forte é formada por profissionais que se respeitam e se apoiam.",
  "Na saúde, cada função importa e cada pessoa faz diferença.",
  "Juntos, somos mais fortes para enfrentar os desafios do cuidado.",
  "A força de um hospital está nas pessoas que fazem acontecer.",
  "Valorizar a equipe é investir na qualidade da assistência.",
  "O trabalho de cada profissional contribui para a recuperação de alguém.",
  "Respeito, união e compromisso fazem uma equipe crescer.",
  "Uma equipe alinhada transforma esforço em resultado.",
  "Profissionais comprometidos constroem uma assistência mais segura.",
  "Cuidar de quem cuida também é responsabilidade da gestão.",
  "Uma equipe motivada faz mais do que cumprir tarefas: transforma realidades.",
  "A enfermagem é força, cuidado, conhecimento e humanidade.",
  "Cada plantão é uma oportunidade de fazer a diferença.",
  "Trabalhar em equipe é entender que o objetivo é maior que cada indivíduo.",
  "Quando existe união, até os plantões mais difíceis se tornam possíveis.",
  "O cuidado começa muito antes de chegar ao leito: começa na equipe.",
  "Por trás de cada prontuário existe uma história que merece cuidado.",
  "Cuidar da saúde é cuidar de vidas, histórias e sonhos.",
  "Humanizar é enxergar a pessoa antes de enxergar o diagnóstico.",
  "Um atendimento de qualidade começa com respeito.",
  "A melhor tecnologia de um hospital continua sendo o cuidado humano.",
  "Cada paciente merece ser tratado com dignidade, respeito e esperança.",
  "Pequenos gestos podem fazer uma grande diferença na recuperação.",
  "Cuidar é mais do que tratar: é acolher.",
  "A saúde melhora quando conhecimento e humanidade caminham juntos.",
  "Um olhar atento também faz parte do cuidado.",
  "Escutar o paciente é uma forma de cuidar.",
  "Acolhimento também é tratamento.",
  "Humanização não é detalhe; é parte essencial da assistência.",
  "Cada paciente é único, e seu cuidado também deve ser.",
  "Onde existe empatia, o cuidado ganha um novo significado.",
  "Cuidar com técnica é necessário; cuidar com humanidade é essencial.",
  "Saúde é compromisso com a vida em todas as suas dimensões.",
  "O cuidado começa quando alguém decide fazer a diferença.",
  "Um ambiente acolhedor também contribui para a recuperação.",
  "Toda vida atendida merece respeito, atenção e responsabilidade.",
  "Organização é a base de uma gestão que entrega resultados.",
  "Indicadores mostram números; pessoas dão significado aos resultados.",
  "Planejamento transforma intenção em ação.",
  "Processos bem estruturados tornam o trabalho mais seguro e eficiente.",
  "A melhoria contínua começa quando decidimos fazer melhor.",
  "Administrar bem é utilizar recursos com responsabilidade e propósito.",
  "Cada melhoria no processo representa uma oportunidade de melhorar o cuidado.",
  "Resultados sustentáveis são construídos com planejamento e disciplina.",
  "Eficiência não é fazer mais; é fazer melhor.",
  "Organização reduz problemas e aumenta a capacidade de cuidar.",
  "Decisões baseadas em dados fortalecem a gestão.",
  "O planejamento é o caminho entre o desafio e a solução.",
  "Toda dificuldade pode revelar uma oportunidade de melhoria.",
  "Gestão de qualidade exige acompanhamento, avaliação e atitude.",
  "O que não é planejado pode se tornar um problema; o que é planejado pode virar resultado.",
  "Processos melhores constroem serviços melhores.",
  "A excelência não acontece por acaso: ela é planejada.",
  "Cada detalhe bem administrado contribui para um hospital mais eficiente.",
  "Boa gestão é transformar recursos limitados em melhores resultados.",
  "Melhorar continuamente é nunca se acomodar com o que pode ser aperfeiçoado.",
  "Liderar é inspirar pelo exemplo.",
  "Um bom líder não caminha à frente da equipe; caminha junto com ela.",
  "Liderança verdadeira se constrói com respeito, diálogo e responsabilidade.",
  "Quem lidera pessoas precisa primeiro aprender a ouvir.",
  "Desafios fazem parte da gestão; desistir não precisa fazer.",
  "Toda grande mudança começa com uma decisão.",
  "A liderança transforma visão em movimento.",
  "Motivação cresce quando as pessoas percebem que seu trabalho tem propósito.",
  "Um líder forte constrói equipes capazes de seguir mesmo diante dos desafios.",
  "Inspirar pessoas é uma das maiores responsabilidades de quem lidera.",
  "Não existe equipe excelente sem liderança comprometida.",
  "Liderar é acreditar nas pessoas e ajudá-las a desenvolver seu potencial.",
  "Desafios não definem uma equipe; a forma como ela os enfrenta, sim.",
  "Toda conquista começa quando alguém decide não desistir.",
  "O trabalho de hoje pode ser a melhoria que fará diferença amanhã.",
  "Quando existe propósito, o esforço ganha significado.",
  "A força de uma instituição está na capacidade de transformar desafios em aprendizado.",
  "Cada profissional é parte importante da história que estamos construindo.",
  "Juntos, podemos fazer do hospital não apenas um lugar de atendimento, mas um espaço de cuidado e transformação.",
  "Cuidar, liderar e servir: três atitudes que transformam vidas e fortalecem a saúde."
]

const MOTIVATIONAL_SETTINGS_KEY = 'motivational_phrases_v1'
const MOTIVATIONAL_SEEDED_KEY = 'motivational_phrases_v1_seeded'

function uid(i) {
  return `seed_v2_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`
}

function buildPhrases() {
  const now = new Date().toISOString()
  return FRASES_100.map((text, i) => ({
    id: uid(i),
    text: String(text).trim().slice(0, 500),
    active: true,
    createdAt: now
  }))
}

async function main() {
  const phrases = buildPhrases()
  console.log(`\n=====================================`)
  console.log(`✅ ${FRASES_100.length} frases carregadas em memoria.`)
  console.log(`=====================================\n`)

  // ===== (A) MODO LOCAL data/db.json =====
  const dbPath = path.join(__dirname, '..', 'data', 'db.json')
  let localOk = false
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8')
      const db = JSON.parse(raw)
      const countAntes = Array.isArray(db[MOTIVATIONAL_SETTINGS_KEY]) ? db[MOTIVATIONAL_SETTINGS_KEY].length : 0
      db[MOTIVATIONAL_SETTINGS_KEY] = phrases
      db[MOTIVATIONAL_SEEDED_KEY] = 1
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8')
      console.log(`[MODO LOCAL] db.json atualizado!`)
      console.log(`  Frases ANTES: ${countAntes}`)
      console.log(`  Frases DEPOIS: ${phrases.length}`)
      console.log(`  Arquivo: ${dbPath}`)
      localOk = true
    } else {
      console.log(`[MODO LOCAL] data/db.json NAO EXISTE (esperado se roda apenas Supabase). Pulando.`)
    }
  } catch (e) {
    console.error(`[MODO LOCAL] ERRO:`, e.message || String(e))
  }

  // ===== (B) SUPABASE REAL via ANON (ou SERVICE_ROLE se existir) =====
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  let supabaseOk = false
  if (!serviceRole || !url) {
    console.log(`\n[SUPABASE] SKIP: variaveis NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY NAO encontradas em .env.local. Pulando.\n`)
  } else {
    try {
      const { createClient } = require('@supabase/supabase-js')
      const supabase = createClient(url, serviceRole, {
        auth: { persistSession: false, autoRefreshToken: false }
      })

      const { data: beforeRow, error: errB } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', MOTIVATIONAL_SETTINGS_KEY)
        .maybeSingle()
      let countAntes = 0
      if (!errB && beforeRow && typeof beforeRow.value === 'string') {
        try { countAntes = JSON.parse(beforeRow.value).length } catch {}
      }

      const upsertPayload = [
        { key: MOTIVATIONAL_SETTINGS_KEY, value: JSON.stringify(phrases) },
        { key: MOTIVATIONAL_SEEDED_KEY, value: '1' }
      ]
      const { error: errU } = await supabase
        .from('app_settings')
        .upsert(upsertPayload, { onConflict: 'key' })
      if (errU) {
        console.error(`\n[SUPABASE] ERRO UPSERT app_settings:`, errU.code, errU.message, errU.details || '')
        throw errU
      }

      const { data: afterRow, error: errA } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', MOTIVATIONAL_SETTINGS_KEY)
        .maybeSingle()
      let countDepois = 0
      if (!errA && afterRow && typeof afterRow.value === 'string') {
        try { countDepois = JSON.parse(afterRow.value).length } catch {}
      }
      console.log(`\n[SUPABASE REAL] app_settings atualizado!`)
      console.log(`  Frases ANTES: ${countAntes}`)
      console.log(`  Frases DEPOIS: ${countDepois}`)
      console.log(`  URL: ${url}`)
      supabaseOk = true
    } catch (e) {
      console.error(`[SUPABASE] ERRO CRITICO:`, e.message || String(e))
    }
  }

  console.log(`\n=====================================`)
  console.log(`RESUMO:`)
  console.log(`  MODO LOCAL   : ${localOk ? '✅ SUCESSO' : '⚠️  SKIP (arquivo não existe ou erro)'}`)
  console.log(`  SUPABASE REAL: ${supabaseOk ? '✅ SUCESSO' : '⚠️  SKIP/ERRO'}`)
  console.log(`  Total frases : ${phrases.length}`)
  console.log(`\nDICA: se o navegador estiver aberto -> CTRL+SHIFT+R para recarregar sem cache e ver as frases novas!`)
  console.log(`=====================================\n`)
}

main().catch((e) => {
  console.error(`\n❌ FALHA GERAL:`, e)
  process.exit(1)
})
