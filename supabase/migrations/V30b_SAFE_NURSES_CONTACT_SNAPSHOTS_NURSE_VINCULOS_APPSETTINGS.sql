-- Migration V30b - MÍNIMO ESSENCIAL: Apenas colunas de contato em nurses e snapshots V26
-- (Evita criar login_logs e sequences que podem conflitar)

-- PASSO 1: app_settings (chave/valor) - FUNDAMENTAL
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON TABLE public.app_settings TO postgres, anon, authenticated, service_role;

-- PASSO 2: nurse_vinculos (1:N vínculos com profissionais) - FUNDAMENTAL
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

-- PASSO 3: COLUNAS CONTATO em nurses
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS phone TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS address TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS house_number TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS city TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS email TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS birth_date DATE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS certidao_negativa_date DATE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS coren_expiry_date DATE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.nurses ADD COLUMN IF NOT EXISTS name_star TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- PASSO 4: V26 monthly_rosters snapshots
DO $$ BEGIN ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_name TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_role TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_vinculo TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.monthly_rosters ADD COLUMN IF NOT EXISTS snapshot_vinculos_json JSONB; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- PASSO 5: V26 shifts snapshots
DO $$ BEGIN ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_name TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_role TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_vinculo TEXT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS snapshot_vinculos_json JSONB; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- PASSO 6: Permissões
GRANT ALL ON TABLE public.nurses TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.monthly_rosters TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.shifts TO postgres, anon, authenticated, service_role;
