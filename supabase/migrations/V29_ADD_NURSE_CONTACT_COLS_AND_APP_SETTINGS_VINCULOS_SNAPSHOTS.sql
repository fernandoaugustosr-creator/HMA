-- ================================================================
-- MIGRATION: ADD_MISSING_NURSE_CONTACT_COLUMNS_AND_TABLES
-- Objetivo: adicionar as colunas CONTATO (email, phone, address, house_number, city) e demais
-- colunas necessárias na tabela `nurses` no Supabase real.
-- Também cria tabelas faltantes: `app_settings`, `nurse_vinculos`, `login_logs`,
-- colunas V26 de snapshot em monthly_rosters e shifts.
-- Seguro: usa IF NOT EXISTS em tudo.
-- ================================================================

-- 1) app_settings (se não existir)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON TABLE public.app_settings TO postgres, anon, authenticated, service_role;

-- 2) login_logs (se não existir)
CREATE TABLE IF NOT EXISTS public.login_logs (
    id BIGSERIAL PRIMARY KEY,
    cpf TEXT,
    role TEXT,
    name TEXT,
    unit TEXT,
    success BOOLEAN DEFAULT true,
    ip TEXT,
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON public.login_logs(created_at DESC);
GRANT ALL ON TABLE public.login_logs TO postgres, anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.login_logs_id_seq TO anon, authenticated, service_role;

-- 3) nurse_vinculos (1:N por profissional)
CREATE TABLE IF NOT EXISTS public.nurse_vinculos (
    id BIGSERIAL PRIMARY KEY,
    nurse_id BIGINT NOT NULL REFERENCES public.nurses(id) ON DELETE CASCADE,
    vinculo TEXT NOT NULL,
    status TEXT DEFAULT 'ATIVO',
    baixa_data DATE,
    baixa_motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nurse_vinculos_nurse_id ON public.nurse_vinculos(nurse_id);
GRANT ALL ON TABLE public.nurse_vinculos TO postgres, anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.nurse_vinculos_id_seq TO anon, authenticated, service_role;

-- 4) COLUNAS FALTANTES EM nurses (CONTATO + DADOS PESSOAIS)
-- Safe: cada ALTER TABLE tem o seu próprio DO block (ignora se já existe)

DO $$ BEGIN
  ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS house_number TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS birth_date DATE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS certidao_negativa_date DATE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS coren_expiry_date DATE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS name_star TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 5) V26 - Snapshot Pattern em monthly_rosters (congelar nome/cargo/vinculo histórico)
DO $$ BEGIN
  ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_name TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_role TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_vinculo TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_vinculos_json JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 6) V26 - Snapshot Pattern em shifts
DO $$ BEGIN
  ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_name TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_role TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_vinculo TEXT DEFAULT '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_vinculos_json JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 7) Garantir permissões nurses (service_role + authenticated + anon)
GRANT ALL ON TABLE public.nurses TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.monthly_rosters TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.shifts TO postgres, anon, authenticated, service_role;
