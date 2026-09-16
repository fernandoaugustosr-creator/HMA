-- =========================================================================
-- HMA - BANCO DE DADOS COMPLETO (SCHEMA 100%) - SUPABASE
-- Atualizado em: 2026-09-16 (migration V30b + snapshots V26 + vínculos 1:N)
-- Como usar: Abra o Supabase Dashboard > SQL Editor > New Query > Cole TODO
-- este arquivo > Run (CTRL+ENTER). Roda em banco NOVO ou EXISTENTE (tudo IF NOT EXISTS).
-- =========================================================================

-- 0) EXTENSÕES OBRIGATÓRIAS (gen_random_uuid / uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1) SCHEMA PUBLIC (padrão Supabase)
-- =========================================================================
SET search_path TO public;

-- =========================================================================
-- 2) TABELAS BASE (SEM FKs PRIMEIRO)
-- =========================================================================

-- 2.1) SECTIONS / SETORES GRUPO (ex: ENFERMAGEM, MÉDICOS)
CREATE TABLE IF NOT EXISTS public.schedule_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    "position" INTEGER DEFAULT 0,
    sector_title TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2.2) UNITS / SETORES INDIVIDUAIS (ex: BUCOMAXILOFACIAL, PEDIATRIA, SAMU)
CREATE TABLE IF NOT EXISTS public.units (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2.3) APP_SETTINGS (configurações chave/valor jsonb)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    bool_value BOOLEAN,
    value JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2.4) SYSTEM_ROLES / CARGOS
CREATE TABLE IF NOT EXISTS public.system_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    label TEXT NOT NULL,
    "group" TEXT,
    dynamic_field TEXT DEFAULT 'coren',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2.5) COUNCIL_TYPES / CONSELHOS (COREN / CRM / COREMU...)
CREATE TABLE IF NOT EXISTS public.council_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2.6) MOTIVATIONAL_PHRASES / FRASES MOTIVACIONAIS
CREATE TABLE IF NOT EXISTS public.motivational_phrases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2.7) UNITS_USERS (vínculo opcional units <-> nurses para múltiplos setores)
CREATE TABLE IF NOT EXISTS public.units_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nurse_id UUID,
    unit_id UUID,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 3) NURSES / SERVIDORES (TABELA PRINCIPAL, FK para sections/units)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.nurses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    cpf TEXT NOT NULL,
    password TEXT DEFAULT '123456',
    role TEXT DEFAULT 'ENFERMEIRO',
    coren TEXT,
    vinculo TEXT,
    section_id UUID REFERENCES public.schedule_sections(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    crm TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    birth_date DATE,
    certidao_negativa_date DATE,
    coren_expiry_date DATE,
    name_star BOOLEAN DEFAULT FALSE,
    address TEXT,
    house_number TEXT,
    city TEXT,
    email TEXT
);
CREATE INDEX IF NOT EXISTS idx_nurses_cpf ON public.nurses(cpf);
CREATE INDEX IF NOT EXISTS idx_nurses_unit_id ON public.nurses(unit_id);
CREATE INDEX IF NOT EXISTS idx_nurses_section_id ON public.nurses(section_id);

-- =========================================================================
-- 4) NURSE_VINCULOS (1:N com nurses, vínculos do servidor)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.nurse_vinculos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nurse_id UUID NOT NULL REFERENCES public.nurses(id) ON DELETE CASCADE,
    tipo_vinculo TEXT NOT NULL DEFAULT 'OUTRO',
    data_admissao TEXT DEFAULT '',
    data_baixa TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nurse_vinculos_nurse_id ON public.nurse_vinculos(nurse_id);

-- =========================================================================
-- 5) MONTHLY_ROSTERS / LINHAS DA ESCALA (1 profissional por mês/ano)
--    + SNAPSHOTS V26
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.monthly_rosters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nurse_id UUID REFERENCES public.nurses(id) ON DELETE SET NULL,
    section_id UUID REFERENCES public.schedule_sections(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    observation TEXT,
    sector TEXT,
    list_order INTEGER,
    name_star BOOLEAN DEFAULT FALSE,
    snapshot_name TEXT,
    snapshot_role TEXT,
    snapshot_vinculo TEXT,
    snapshot_vinculos_json JSONB
);
CREATE INDEX IF NOT EXISTS idx_monthly_rosters_nurse_id ON public.monthly_rosters(nurse_id);
CREATE INDEX IF NOT EXISTS idx_monthly_rosters_unit_month_year ON public.monthly_rosters(unit_id, month, year);
CREATE INDEX IF NOT EXISTS idx_monthly_rosters_section_month_year ON public.monthly_rosters(section_id, month, year);

-- =========================================================================
-- 6) SHIFTS / PLANTÕES (cada dia do mês, FK monthly_rosters)
--    + SNAPSHOTS V26
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nurse_id UUID REFERENCES public.nurses(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    roster_id UUID REFERENCES public.monthly_rosters(id) ON DELETE SET NULL,
    is_red BOOLEAN DEFAULT FALSE,
    snapshot_name TEXT,
    snapshot_role TEXT,
    snapshot_vinculo TEXT,
    snapshot_vinculos_json JSONB
);
CREATE INDEX IF NOT EXISTS idx_shifts_nurse_date ON public.shifts(nurse_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_roster_id ON public.shifts(roster_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.shifts(date);

-- =========================================================================
-- 7) TIME_OFF_REQUESTS / FÉRIAS / AFASTAMENTOS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.time_off_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nurse_id UUID REFERENCES public.nurses(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    type TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_nurse_id ON public.time_off_requests(nurse_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_unit_id ON public.time_off_requests(unit_id);

-- =========================================================================
-- 8) SHIFT_SWAPS / TROCA DE PLANTÕES
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.shift_swaps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID REFERENCES public.nurses(id) ON DELETE SET NULL,
    requested_id UUID REFERENCES public.nurses(id) ON DELETE SET NULL,
    requester_shift_date DATE NOT NULL,
    requested_shift_date DATE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 9) MONTHLY_NOTES / ANOTAÇÕES MENSAIS DO SETOR
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.monthly_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monthly_notes_unit_month_year ON public.monthly_notes(unit_id, month, year);

-- =========================================================================
-- 10) MONTHLY_SCHEDULE_METADATA / LIBERAÇÃO DA ESCALA
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.monthly_schedule_metadata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    is_released BOOLEAN DEFAULT FALSE,
    released_at TIMESTAMPTZ,
    released_by UUID,
    footer_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    dynamic_field TEXT DEFAULT 'coren',
    is_setor_hidden BOOLEAN DEFAULT FALSE,
    release_signature TEXT
);
CREATE INDEX IF NOT EXISTS idx_metadata_unit_month_year ON public.monthly_schedule_metadata(unit_id, month, year);

-- =========================================================================
-- 11) ABSENCES / FALTAS (justificadas)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.absences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nurse_id UUID NOT NULL REFERENCES public.nurses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.nurses(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_absences_nurse_date ON public.absences(nurse_id, date);

-- =========================================================================
-- 12) PAYMENT_REQUESTS / SOLICITAÇÕES DE PAGAMENTO (sobreaviso, extra)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nurse_id UUID NOT NULL REFERENCES public.nurses(id) ON DELETE CASCADE,
    coordinator_id UUID REFERENCES public.nurses(id) ON DELETE SET NULL,
    shift_date DATE NOT NULL,
    shift_hours INTEGER CHECK (shift_hours = ANY (ARRAY[12, 24])),
    location TEXT,
    observation TEXT,
    status TEXT DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 13) GENERAL_REQUESTS / SOLICITAÇÕES GERAIS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.general_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nurse_id UUID NOT NULL REFERENCES public.nurses(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'resolved'::text])),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 14) LOGIN_LOGS / LOG DE ACESSOS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.login_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.nurses(id) ON DELETE SET NULL,
    user_name TEXT,
    user_role TEXT,
    login_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON public.login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_login_at ON public.login_logs(login_at DESC);

-- =========================================================================
-- 15) SCHEDULES / ESCALAS (legado - tabela auxiliar)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nurse_id UUID NOT NULL REFERENCES public.nurses(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type TEXT CHECK (shift_type = ANY (ARRAY['day'::text, 'night'::text, 'morning'::text, 'afternoon'::text])),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedules_nurse_date ON public.schedules(nurse_id, shift_date);

-- =========================================================================
-- 16) AUDIT_LOGS / LOG DE AUDITORIA GERAL
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.nurses(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- =========================================================================
-- 17) SCALE_PERMISSIONS / PERMISSÕES INDIVIDUAIS DE ESCALA POR SETOR
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.scale_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nurse_id UUID REFERENCES public.nurses(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scale_permissions_nurse_unit ON public.scale_permissions(nurse_id, unit_id);

-- =========================================================================
-- 18) SEED BÁSICO OBRIGATÓRIO (idempotente, só insere se vazio)
-- =========================================================================

-- 18.1) Seed COUNCIL_TYPES (SEMPRE: COREN E CRM)
INSERT INTO public.council_types (name)
VALUES ('COREN'), ('CRM')
ON CONFLICT (name) DO NOTHING;

-- 18.2) Seed SYSTEM_ROLES PADRÕES (enfermagem) se tabela vazia
INSERT INTO public.system_roles (label, "group", dynamic_field)
SELECT t.label, t."group", t.dynamic_field FROM (
    SELECT 'ENFERMEIRO'  AS label, 'ENFERMAGEM' AS "group", 'coren' AS dynamic_field UNION ALL
    SELECT 'TÉCNICO DE ENFERMAGEM','ENFERMAGEM','coren' UNION ALL
    SELECT 'AUXILIAR DE ENFERMAGEM','ENFERMAGEM','coren' UNION ALL
    SELECT 'MÉDICO','MÉDICOS','crm'
) t
WHERE NOT EXISTS (SELECT 1 FROM public.system_roles LIMIT 1);

-- 18.3) Seed UNITS / SECTIONS se tabela vazia
INSERT INTO public.units (title)
SELECT title FROM (
    SELECT 'ADMINISTRAÇÃO'  AS title UNION ALL
    SELECT 'AMBU-EVENTOS' UNION ALL
    SELECT 'BANCO DE HORAS' UNION ALL
    SELECT 'BUCOMAXILOFACIAL' UNION ALL
    SELECT 'CENTRO CIRÚRGICO' UNION ALL
    SELECT 'CENTRO DE MATERNIDADE' UNION ALL
    SELECT 'CLÍNICA CIRÚRGICA' UNION ALL
    SELECT 'CLÍNICA MÉDICA' UNION ALL
    SELECT 'ENFERMARIA I' UNION ALL
    SELECT 'ENFERMARIA II' UNION ALL
    SELECT 'FARMÁCIA' UNION ALL
    SELECT 'GINECOLOGIA E OBSTETRÍCIA' UNION ALL
    SELECT 'GERIATRIA' UNION ALL
    SELECT 'LABORATÓRIO' UNION ALL
    SELECT 'NEO NATAL' UNION ALL
    SELECT 'PEDIATRIA' UNION ALL
    SELECT 'PLANTONISTA' UNION ALL
    SELECT 'PSIQUIATRIA' UNION ALL
    SELECT 'RAIO X' UNION ALL
    SELECT 'SAMU' UNION ALL
    SELECT 'UCI - UNIDADE DE CUIDADOS INTERMEDIÁRIOS' UNION ALL
    SELECT 'UTI - UNIDADE DE TERAPIA INTENSIVA' UNION ALL
    SELECT 'UNIDADE DE PRONTO ATENDIMENTO - UPA'
) t WHERE NOT EXISTS (SELECT 1 FROM public.units LIMIT 1);

INSERT INTO public.schedule_sections (title, "position")
SELECT t.title, t."position" FROM (
    SELECT 'ENFERMAGEM' AS title, 1 AS "position" UNION ALL
    SELECT 'MÉDICOS', 2 UNION ALL
    SELECT 'OUTROS', 3
) t WHERE NOT EXISTS (SELECT 1 FROM public.schedule_sections LIMIT 1);

-- 18.4) Seed 30 FRASES MOTIVACIONAIS (idempotente: só insere se tabela vazia)
INSERT INTO public.motivational_phrases (text)
SELECT t.text FROM (
    SELECT 'A sua profissão não é um trabalho, é um chamado de amor à vida.' AS text UNION ALL
    SELECT 'Cada cuidado que você oferece hoje é uma semente de esperança para o amanhã.' UNION ALL
    SELECT 'Ser servidor da saúde é ter a coragem de cuidar, mesmo nos dias mais difíceis.' UNION ALL
    SELECT 'As suas mãos acalmam, as suas palavras aliviam, a sua presença cura.' UNION ALL
    SELECT 'O seu esforço não passa despercebido: você é a força que mantém a esperança viva.' UNION ALL
    SELECT 'Cada vida que você toca já não é a mesma graças ao cuidado que você entrega.' UNION ALL
    SELECT 'A saúde não é feita só de tecnologia, mas de olhos que enxergam o ser humano.' UNION ALL
    SELECT 'Você não está sozinho: o seu time é a sua maior fortaleza.' UNION ALL
    SELECT 'Nos dias de fadiga, lembre-se do porquê de ter começado: você faz a diferença.' UNION ALL
    SELECT 'O plantão é longo, mas o seu impacto é eterno na vida de quem você cuida.' UNION ALL
    SELECT 'Profissional da saúde é quem segura a mão de quem tem medo e diz: "estou aqui".' UNION ALL
    SELECT 'A sua dedicação diária é a verdadeira face da humanidade em ação.' UNION ALL
    SELECT 'Não medimos o sucesso pelo número de plantões, mas pelas vidas que transformamos.' UNION ALL
    SELECT 'Um olhar atento, uma palavra certa, um gesto gentil: isso é cuidado em estado puro.' UNION ALL
    SELECT 'Você é a primeira luz que acende no hospital quando a dor chega.' UNION ALL
    SELECT 'Cuidar de quem cuida também é importante: reserve um tempo para você.' UNION ALL
    SELECT 'A sua resiliência inspira todos ao seu redor a nunca desistir da vida.' UNION ALL
    SELECT 'Não existe maior recompensa do que ver um sorriso voltar graças ao seu trabalho.' UNION ALL
    SELECT 'Hospital sem equipe é só prédio — você é o coração que pulsa dentro dele.' UNION ALL
    SELECT 'A rotina é dura, mas a missão é maior do que qualquer cansaço.' UNION ALL
    SELECT 'As suas noites mal dormidas são noites bem dormidas para outras famílias.' UNION ALL
    SELECT 'Coragem é ir para o plantão com esperança renovada todos os dias.' UNION ALL
    SELECT 'Você escolheu a profissão que põe a vida no centro de tudo — orgulhe-se disso.' UNION ALL
    SELECT 'O seu conhecimento somado à empatia é o melhor remédio que existe.' UNION ALL
    SELECT 'Cada detalhe importa: um curativo bem feito, um medicamento na hora, um ombro amigo.' UNION ALL
    SELECT 'Quando a equipe se une, nenhuma adversidade é grande o suficiente para vencê-los.' UNION ALL
    SELECT 'Hospital Municipal de Açailândia é feito de gente como você, que transforma rotina em esperança.' UNION ALL
    SELECT 'Seu compromisso com a vida é o nosso maior patrimônio como instituição.' UNION ALL
    SELECT 'Agradecemos por ser o diferencial em cada atendimento, a cada dia.' UNION ALL
    SELECT 'Hoje, antes de qualquer coisa, lembre-se: você é muito importante para nós.'
) t WHERE NOT EXISTS (SELECT 1 FROM public.motivational_phrases LIMIT 1);

-- Seed da flag de frases motivacionais já aplicadas
INSERT INTO public.app_settings (key, value)
VALUES ('motivational_phrases_v1_seeded', '1'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =========================================================================
-- 19) PERMISSÕES (roles Postgres: postgres / anon / authenticated / service_role)
-- =========================================================================
GRANT ALL ON TABLE public.app_settings             TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.schedule_sections        TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.units                    TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.nurses                   TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.nurse_vinculos           TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.monthly_rosters          TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.shifts                   TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.time_off_requests        TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.shift_swaps              TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.monthly_notes            TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.monthly_schedule_metadata TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.absences                 TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.payment_requests         TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.general_requests         TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.login_logs               TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.schedules                TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.audit_logs               TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.scale_permissions        TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.system_roles             TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.council_types            TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.motivational_phrases     TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.units_users              TO postgres, anon, authenticated, service_role;

-- =========================================================================
-- FIM DO SCRIPT DE CRIAÇÃO. PRÓXIMO PASSO: rodar o dump de dados (HMA_FULL_DATA_DUMP.sql)
-- =========================================================================
