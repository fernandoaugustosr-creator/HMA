-- PASSO 1: Criar app_settings (se não existir — sem created_at/updated_at conflitos)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON TABLE public.app_settings TO postgres, anon, authenticated, service_role;

-- PASSO 2: login_logs (igura independente
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
GRANT ALL ON TABLE public.login_logs TO postgres, anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.login_logs_id_seq TO anon, authenticated, service_role;

-- PASSO 3: nurse_vinculos (sem updated_at, para não conflitar com colunas existentes)
CREATE TABLE IF NOT EXISTS public.nurse_vinculos (
    id BIGSERIAL PRIMARY KEY,
    nurse_id BIGINT NOT NULL REFERENCES public.nurses(id) ON DELETE CASCADE,
    vinculo TEXT NOT NULL,
    status TEXT DEFAULT 'ATIVO',
    baixa_data DATE,
    baixa_motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nurse_vinculos_nurse_id ON public.nurse_vinculos(nurse_id);
GRANT ALL ON TABLE public.nurse_vinculos TO postgres, anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.nurse_vinculos_id_seq TO anon, authenticated, service_role;

-- PASSO 4: COLUNAS DE CONTATO E DADOS PESSOAIS EM nurses
-- Cada coluna em bloco separado
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS phone TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS address TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS house_number TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS city TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS email TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS birth_date DATE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS certidao_negativa_date DATE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS coren_expiry_date DATE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS name_star TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Defaults separados (não tem default)

-- PASSO 5: V26 snapshots monthly_rosters
DO $$ BEGIN ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_name TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_role TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_vinculo TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_vinculos_json JSONB; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- PASSO 6: V26 snapshots shifts
DO $$ BEGIN ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_name TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_role TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_vinculo TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_vinculos_json JSONB; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- PASSO 7: Permissões gerais
GRANT ALL ON TABLE public.nurses TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.monthly_rosters TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.shifts TO postgres, anon, authenticated, service_role;
