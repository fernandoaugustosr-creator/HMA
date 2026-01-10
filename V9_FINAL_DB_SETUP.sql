-- SCRIPT DE CONFIGURAÇÃO FINAL DO BANCO DE DADOS (V9)
-- Este script cria todas as tabelas e colunas necessárias para a liberação de escalas e assinaturas.
-- Execute este script no SQL Editor do Supabase.

-- 1. Cria a tabela de metadados (liberação de escala e rodapé) se não existir
CREATE TABLE IF NOT EXISTS monthly_schedule_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  is_released BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMP WITH TIME ZONE,
  footer_text TEXT, -- Campo para o texto do rodapé
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(month, year, unit_id)
);

-- 2. Cria índice para performance se não existir
CREATE INDEX IF NOT EXISTS idx_monthly_schedule_metadata_lookup ON monthly_schedule_metadata (month, year, unit_id);

-- 3. Garante que a coluna footer_text exista na tabela de metadados (caso a tabela já existisse sem ela)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_schedule_metadata' AND column_name = 'footer_text') THEN
        ALTER TABLE monthly_schedule_metadata ADD COLUMN footer_text TEXT;
    END IF;
END $$;

-- 4. Garante que a coluna sector_title exista na tabela de seções (evita erro de coluna duplicada)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_sections' AND column_name = 'sector_title') THEN
        ALTER TABLE schedule_sections ADD COLUMN sector_title TEXT;
    END IF;
END $$;

-- 5. Habilitar RLS (Row Level Security) se ainda não estiver habilitado
ALTER TABLE monthly_schedule_metadata ENABLE ROW LEVEL SECURITY;

-- 6. Criar política de acesso público (para simplificar, já que o controle é feito no backend)
DROP POLICY IF EXISTS "Public access monthly_schedule_metadata" ON monthly_schedule_metadata;
CREATE POLICY "Public access monthly_schedule_metadata" ON monthly_schedule_metadata FOR ALL USING (true) WITH CHECK (true);
