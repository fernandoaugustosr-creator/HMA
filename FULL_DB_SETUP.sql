-- SCRIPT COMPLETO DE CONFIGURAÇÃO DO BANCO DE DADOS (ENF-HMA)
-- Versão consolidada (V15 + V16 + V17)
-- Este script cria ou atualiza TODAS as tabelas, índices, políticas e dados iniciais.
-- Copie e cole TODO este conteúdo no SQL Editor do Supabase e clique em RUN.

-- ==============================================================================
-- 1. EXTENSÕES
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABELAS (Versão mais recente)
-- Baseado em V15_COMPLETE_SCHEMA_LATEST.sql
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

-- Plantões (Shifts) - com roster_id
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
  roster_id UUID REFERENCES monthly_rosters(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Solicitações de Folga / Licenças - com unit_id
CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id),
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

-- Logs de Login (V16)
CREATE TABLE IF NOT EXISTS login_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES nurses(id) ON DELETE SET NULL,
    user_name TEXT,
    user_role TEXT,
    login_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ==============================================================================
-- 3. AJUSTES E ÍNDICES (inclui correção V17)
-- ==============================================================================

-- Garantir colunas novas (roster_id, unit_id)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'roster_id') THEN
        ALTER TABLE shifts ADD COLUMN roster_id UUID REFERENCES monthly_rosters(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_off_requests' AND column_name = 'unit_id') THEN
        ALTER TABLE time_off_requests ADD COLUMN unit_id UUID REFERENCES units(id);
    END IF;
END $$;

-- Índices de notas / metadados / performance
CREATE UNIQUE INDEX IF NOT EXISTS monthly_notes_month_year_unit_idx ON monthly_notes (month, year, unit_id) WHERE unit_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS monthly_notes_month_year_no_unit_idx ON monthly_notes (month, year) WHERE unit_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_monthly_schedule_metadata_lookup ON monthly_schedule_metadata (month, year, unit_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_nurse ON shifts(nurse_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_status ON time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_dates ON time_off_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_monthly_rosters_month_year_unit ON monthly_rosters(month, year, unit_id);

-- Corrigir índices de escala dupla (V17)
DROP INDEX IF EXISTS idx_shifts_roster_date_unique;
CREATE UNIQUE INDEX idx_shifts_roster_date_unique 
ON shifts(roster_id, date);

DROP INDEX IF EXISTS idx_shifts_nurse_date_legacy_unique;
CREATE UNIQUE INDEX idx_shifts_nurse_date_legacy_unique 
ON shifts(nurse_id, date) 
WHERE roster_id IS NULL;

-- ==============================================================================
-- 4. RLS E POLÍTICAS
-- ==============================================================================

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
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

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

    DROP POLICY IF EXISTS "Public access login_logs" ON login_logs;
    CREATE POLICY "Public access login_logs" ON login_logs FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ==============================================================================
-- 5. DADOS INICIAIS
-- ==============================================================================

INSERT INTO nurses (name, cpf, password, role)
SELECT 'Administrador', '02170025367', '123456', 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM nurses WHERE cpf = '02170025367');

INSERT INTO app_settings (key, bool_value)
VALUES ('allow_same_day_swap', FALSE)
ON CONFLICT (key) DO NOTHING;
