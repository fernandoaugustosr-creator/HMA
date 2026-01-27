-- V15_COMPLETE_SCHEMA_LATEST.sql
-- Este script contém TODO o esquema do banco de dados atualizado, 
-- consolidando todas as correções (V10, V12, V13, V14).
-- Execute-o no Supabase SQL Editor para criar ou atualizar todo o banco.

-- ==============================================================================
-- 1. EXTENSÕES
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABELAS (Criação se não existirem)
-- ==============================================================================

-- Seções (Enfermeiros, Técnicos)
CREATE TABLE IF NOT EXISTS schedule_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  position SERIAL,
  sector_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Setores/Unidades (Posto 1, Posto 2)
CREATE TABLE IF NOT EXISTS units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enfermeiros
CREATE TABLE IF NOT EXISTS nurses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL DEFAULT '123456',
  coren TEXT,
  role TEXT DEFAULT 'ENFERMEIRO',
  vinculo TEXT,
  section_id UUID REFERENCES schedule_sections(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Lotação Mensal (Roster)
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

-- Plantões (Shifts) - ATUALIZADO V12 (roster_id)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
  roster_id UUID REFERENCES monthly_rosters(id) ON DELETE CASCADE, -- V12
  date DATE NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Solicitações de Folga - ATUALIZADO V13 (unit_id)
CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id), -- V13
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  type TEXT DEFAULT 'folga',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Metadados da Escala (Liberação, Rodapé)
CREATE TABLE IF NOT EXISTS monthly_schedule_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  is_released BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMP WITH TIME ZONE,
  released_by UUID,
  footer_text TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(month, year, unit_id)
);

-- Notas Mensais
CREATE TABLE IF NOT EXISTS monthly_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurações
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  bool_value BOOLEAN,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Faltas
CREATE TABLE IF NOT EXISTS absences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
  created_by UUID REFERENCES nurses(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Solicitações de Pagamento
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
  coordinator_id UUID REFERENCES nurses(id) ON DELETE SET NULL,
  shift_date DATE NOT NULL,
  shift_hours INTEGER NOT NULL,
  location TEXT NOT NULL,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Solicitações Gerais
CREATE TABLE IF NOT EXISTS general_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  request_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Permutas
CREATE TABLE IF NOT EXISTS shift_swaps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
    requested_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
    requester_shift_date DATE NOT NULL,
    requested_shift_date DATE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 3. AJUSTES ESTRUTURAIS IMPORTANTES (ATUALIZAÇÕES)
-- ==============================================================================

-- Garantir coluna roster_id em shifts (V12)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'roster_id') THEN
        ALTER TABLE shifts ADD COLUMN roster_id UUID REFERENCES monthly_rosters(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Garantir coluna unit_id em time_off_requests (V13)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_off_requests' AND column_name = 'unit_id') THEN
        ALTER TABLE time_off_requests ADD COLUMN unit_id UUID REFERENCES units(id);
    END IF;
END $$;

-- ==============================================================================
-- 4. CORREÇÃO DE DUPLICIDADE (V14 - CRÍTICO PARA ESCALA DUPLA)
-- ==============================================================================

-- Remover constraints antigas e conflitantes
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_nurse_id_shift_date_key;
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_nurse_id_date_key;
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_nurse_id_key;

-- Remover índices antigos
DROP INDEX IF EXISTS idx_shifts_nurse_date_unique;
DROP INDEX IF EXISTS idx_shifts_roster_date_unique;

-- 4.1 LIMPEZA DE DUPLICIDADES (CRÍTICO PARA CRIAR ÍNDICE ÚNICO)
-- Remove turnos duplicados para o mesmo roster_id e data, mantendo apenas o mais recente
DELETE FROM shifts
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY roster_id, date ORDER BY created_at DESC) as rnum
    FROM shifts
    WHERE roster_id IS NOT NULL
  ) t
  WHERE t.rnum > 1
);

-- Criar Novos Índices Parciais (Permite Escala Dupla)
-- Caso A: Turnos com escala definida (unicidade por escala + dia)
-- OBS: Removido 'WHERE roster_id IS NOT NULL' para permitir que o ON CONFLICT funcione corretamente
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_roster_date_unique 
ON shifts(roster_id, date);

-- 4.2 LIMPEZA DE DUPLICIDADES LEGADAS (CRÍTICO PARA CRIAR ÍNDICE ÚNICO)
-- Remove turnos duplicados para o mesmo nurse_id e data (apenas legados), mantendo apenas o mais recente
DELETE FROM shifts
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY nurse_id, date ORDER BY created_at DESC) as rnum
    FROM shifts
    WHERE roster_id IS NULL
  ) t
  WHERE t.rnum > 1
);

-- Caso B: Turnos legados (unicidade por enfermeiro + dia)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_nurse_date_legacy_unique 
ON shifts(nurse_id, date) 
WHERE roster_id IS NULL;

-- ==============================================================================
-- 5. POLÍTICAS DE SEGURANÇA (RLS) - Permite Acesso Total (Simplificado)
-- ==============================================================================

-- Habilitar RLS
ALTER TABLE schedule_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_schedule_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;

-- Criar políticas (DROP antes para garantir atualização)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public access schedule_sections" ON schedule_sections;
    CREATE POLICY "Public access schedule_sections" ON schedule_sections FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access units" ON units;
    CREATE POLICY "Public access units" ON units FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access nurses" ON nurses;
    CREATE POLICY "Public access nurses" ON nurses FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access shifts" ON shifts;
    CREATE POLICY "Public access shifts" ON shifts FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access monthly_rosters" ON monthly_rosters;
    CREATE POLICY "Public access monthly_rosters" ON monthly_rosters FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access time_off_requests" ON time_off_requests;
    CREATE POLICY "Public access time_off_requests" ON time_off_requests FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access monthly_notes" ON monthly_notes;
    CREATE POLICY "Public access monthly_notes" ON monthly_notes FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access monthly_schedule_metadata" ON monthly_schedule_metadata;
    CREATE POLICY "Public access monthly_schedule_metadata" ON monthly_schedule_metadata FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access app_settings" ON app_settings;
    CREATE POLICY "Public access app_settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access absences" ON absences;
    CREATE POLICY "Public access absences" ON absences FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access payment_requests" ON payment_requests;
    CREATE POLICY "Public access payment_requests" ON payment_requests FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access general_requests" ON general_requests;
    CREATE POLICY "Public access general_requests" ON general_requests FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access shift_swaps" ON shift_swaps;
    CREATE POLICY "Public access shift_swaps" ON shift_swaps FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- 6. DADOS INICIAIS (Apenas se vazio)
-- ==============================================================================

-- Admin Padrão
INSERT INTO nurses (name, cpf, password, role)
SELECT 'Administrador', '02170025367', '123456', 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM nurses WHERE cpf = '02170025367');

-- Configuração padrão
INSERT INTO app_settings (key, bool_value)
VALUES ('allow_same_day_swap', FALSE)
ON CONFLICT (key) DO NOTHING;
