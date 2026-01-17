-- SCRIPT COMPLETO DE CONFIGURAÇÃO DO BANCO DE DADOS (ENF-HMA)
-- Este script cria toda a estrutura necessária do zero ou atualiza a existente.
-- Copie e cole TODO este conteúdo no SQL Editor do Supabase e clique em RUN.

-- ==============================================================================
-- 1. EXTENSÕES E CONFIGURAÇÕES INICIAIS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABELAS PRINCIPAIS
-- ==============================================================================

-- Tabela de Seções/Blocos (Ex: Enfermeiros, Técnicos)
CREATE TABLE IF NOT EXISTS schedule_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  position SERIAL,
  sector_title TEXT, -- Título do setor para cabeçalho (ex: ENFERMARIAS/LEITOS)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Setores/Unidades (Ex: Posto 1, Posto 2)
CREATE TABLE IF NOT EXISTS units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Enfermeiros
CREATE TABLE IF NOT EXISTS nurses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL DEFAULT '123456',
  coren TEXT,
  role TEXT DEFAULT 'ENFERMEIRO', -- 'ENFERMEIRO', 'TECNICO', 'ADMIN'
  vinculo TEXT, -- 'CONCURSO', 'SELETIVO', etc.
  section_id UUID REFERENCES schedule_sections(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Plantões Diários
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL, -- 'D', 'N', 'M', 'T'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Lotação Mensal (Onde o enfermeiro está escalado naquele mês)
CREATE TABLE IF NOT EXISTS monthly_rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id),
  section_id UUID REFERENCES schedule_sections(id) NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(nurse_id, month, year)
);

-- Tabela de Solicitações de Folga / Licenças
CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  type TEXT DEFAULT 'folga', -- 'ferias', 'licenca_saude', etc.
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Notas Mensais
CREATE TABLE IF NOT EXISTS monthly_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Metadados da Escala (Liberação e Rodapé)
CREATE TABLE IF NOT EXISTS monthly_schedule_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  is_released BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMP WITH TIME ZONE,
  released_by UUID, -- ID do usuário que liberou
  footer_text TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(month, year, unit_id)
);

-- ==============================================================================
-- 3. ÍNDICES E PERFORMANCE
-- ==============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS monthly_notes_month_year_unit_idx ON monthly_notes (month, year, unit_id) WHERE unit_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS monthly_notes_month_year_no_unit_idx ON monthly_notes (month, year) WHERE unit_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_monthly_schedule_metadata_lookup ON monthly_schedule_metadata (month, year, unit_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_nurse ON shifts(nurse_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_status ON time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_dates ON time_off_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_monthly_rosters_month_year_unit ON monthly_rosters(month, year, unit_id);

-- ==============================================================================
-- 4. DADOS INICIAIS (Se não existirem)
-- ==============================================================================

-- Inserir Administrador Padrão
INSERT INTO nurses (name, cpf, password, role)
SELECT 'Administrador', '02170025367', '123456', 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM nurses WHERE cpf = '02170025367');

-- Inserir Seções Padrão
INSERT INTO schedule_sections (title, position)
SELECT 'ENFERMEIROS', 1
WHERE NOT EXISTS (SELECT 1 FROM schedule_sections WHERE title = 'ENFERMEIROS');

INSERT INTO schedule_sections (title, position)
SELECT 'TÉCNICOS DE ENFERMAGEM', 2
WHERE NOT EXISTS (SELECT 1 FROM schedule_sections WHERE title = 'TÉCNICOS DE ENFERMAGEM');

-- Inserir Unidades Padrão
INSERT INTO units (title)
SELECT 'POSTO 1'
WHERE NOT EXISTS (SELECT 1 FROM units WHERE title = 'POSTO 1');

INSERT INTO units (title)
SELECT 'POSTO 2'
WHERE NOT EXISTS (SELECT 1 FROM units WHERE title = 'POSTO 2');

-- ==============================================================================
-- 5. POLÍTICAS DE SEGURANÇA (RLS) - Permite tudo para simplificar
-- ==============================================================================

-- Habilitar RLS nas tabelas principais
ALTER TABLE schedule_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_schedule_metadata ENABLE ROW LEVEL SECURITY;

-- Criar políticas públicas (acesso total)
DO $$ 
BEGIN
    -- schedule_sections
    DROP POLICY IF EXISTS "Public access schedule_sections" ON schedule_sections;
    CREATE POLICY "Public access schedule_sections" ON schedule_sections FOR ALL USING (true) WITH CHECK (true);

    -- units
    DROP POLICY IF EXISTS "Public access units" ON units;
    CREATE POLICY "Public access units" ON units FOR ALL USING (true) WITH CHECK (true);

    -- nurses
    DROP POLICY IF EXISTS "Public access nurses" ON nurses;
    CREATE POLICY "Public access nurses" ON nurses FOR ALL USING (true) WITH CHECK (true);

    -- shifts
    DROP POLICY IF EXISTS "Public access shifts" ON shifts;
    CREATE POLICY "Public access shifts" ON shifts FOR ALL USING (true) WITH CHECK (true);

    -- monthly_rosters
    DROP POLICY IF EXISTS "Public access monthly_rosters" ON monthly_rosters;
    CREATE POLICY "Public access monthly_rosters" ON monthly_rosters FOR ALL USING (true) WITH CHECK (true);

    -- time_off_requests
    DROP POLICY IF EXISTS "Public access time_off_requests" ON time_off_requests;
    CREATE POLICY "Public access time_off_requests" ON time_off_requests FOR ALL USING (true) WITH CHECK (true);

    -- monthly_notes
    DROP POLICY IF EXISTS "Public access monthly_notes" ON monthly_notes;
    CREATE POLICY "Public access monthly_notes" ON monthly_notes FOR ALL USING (true) WITH CHECK (true);

    -- monthly_schedule_metadata
    DROP POLICY IF EXISTS "Public access monthly_schedule_metadata" ON monthly_schedule_metadata;
    CREATE POLICY "Public access monthly_schedule_metadata" ON monthly_schedule_metadata FOR ALL USING (true) WITH CHECK (true);
END $$;
