-- =====================================================================
-- V31 — RLS + POLICIES OBRIGATÓRIAS (tabelas novas V30b)
-- Problema: RLS enabled + SEM policies = NINGUÉM grava na tabela.
-- Solução: Criar policies SELECT/INSERT/UPDATE/DELETE p/ authenticated
-- (SE e SOMENTE SE a tabela existir — DO BLOCK IF EXISTS p/ evitar 42P01)
-- =====================================================================

-- =====================================================================
-- 1) nurse_vinculos (PRINCIPAL — vínculos 1:N nurses)
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nurse_vinculos') THEN
    ALTER TABLE public.nurse_vinculos ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "nurse_vinculos_select_authenticated" ON public.nurse_vinculos';
    EXECUTE 'CREATE POLICY "nurse_vinculos_select_authenticated" ON public.nurse_vinculos FOR SELECT USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "nurse_vinculos_insert_authenticated" ON public.nurse_vinculos';
    EXECUTE 'CREATE POLICY "nurse_vinculos_insert_authenticated" ON public.nurse_vinculos FOR INSERT WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "nurse_vinculos_update_authenticated" ON public.nurse_vinculos';
    EXECUTE 'CREATE POLICY "nurse_vinculos_update_authenticated" ON public.nurse_vinculos FOR UPDATE USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "nurse_vinculos_delete_authenticated" ON public.nurse_vinculos';
    EXECUTE 'CREATE POLICY "nurse_vinculos_delete_authenticated" ON public.nurse_vinculos FOR DELETE USING (true)';
    EXECUTE 'GRANT ALL ON TABLE public.nurse_vinculos TO postgres, anon, authenticated, service_role';
  END IF;
END $$;

-- =====================================================================
-- 2) app_settings (chave/valor permissões/flags)
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='app_settings') THEN
    ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "app_settings_select_authenticated" ON public.app_settings';
    EXECUTE 'CREATE POLICY "app_settings_select_authenticated" ON public.app_settings FOR SELECT USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "app_settings_insert_authenticated" ON public.app_settings';
    EXECUTE 'CREATE POLICY "app_settings_insert_authenticated" ON public.app_settings FOR INSERT WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "app_settings_update_authenticated" ON public.app_settings';
    EXECUTE 'CREATE POLICY "app_settings_update_authenticated" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "app_settings_delete_authenticated" ON public.app_settings';
    EXECUTE 'CREATE POLICY "app_settings_delete_authenticated" ON public.app_settings FOR DELETE USING (true)';
    EXECUTE 'GRANT ALL ON TABLE public.app_settings TO postgres, anon, authenticated, service_role';
  END IF;
END $$;

-- =====================================================================
-- 3) motivational_phrases (só se existir)
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='motivational_phrases') THEN
    ALTER TABLE public.motivational_phrases ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "motivational_phrases_select_authenticated" ON public.motivational_phrases';
    EXECUTE 'CREATE POLICY "motivational_phrases_select_authenticated" ON public.motivational_phrases FOR SELECT USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "motivational_phrases_insert_authenticated" ON public.motivational_phrases';
    EXECUTE 'CREATE POLICY "motivational_phrases_insert_authenticated" ON public.motivational_phrases FOR INSERT WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "motivational_phrases_update_authenticated" ON public.motivational_phrases';
    EXECUTE 'CREATE POLICY "motivational_phrases_update_authenticated" ON public.motivational_phrases FOR UPDATE USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "motivational_phrases_delete_authenticated" ON public.motivational_phrases';
    EXECUTE 'CREATE POLICY "motivational_phrases_delete_authenticated" ON public.motivational_phrases FOR DELETE USING (true)';
    EXECUTE 'GRANT ALL ON TABLE public.motivational_phrases TO postgres, anon, authenticated, service_role';
  END IF;
END $$;

-- =====================================================================
-- 4) system_roles / council_types / units_users (só se existirem)
-- =====================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['system_roles','council_types','units_users'] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select_authenticated', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', t||'_select_authenticated', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_insert_authenticated', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (true)', t||'_insert_authenticated', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update_authenticated', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (true) WITH CHECK (true)', t||'_update_authenticated', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_delete_authenticated', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (true)', t||'_delete_authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO postgres, anon, authenticated, service_role', t);
    END IF;
  END LOOP;
END $$;
