-- V3: ADICIONAR COLUNA OBSERVATION NA TABELA MONTHLY_ROSTERS
-- Este script adiciona a coluna 'observation' necessária para a funcionalidade de Escala Dupla.
-- Rode este script no Editor SQL do Supabase.

-- Adicionar coluna observation se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_rosters' AND column_name = 'observation') THEN
        ALTER TABLE monthly_rosters ADD COLUMN observation TEXT;
    END IF;
END $$;

-- Atualizar cache do esquema
NOTIFY pgrst, 'reload schema';
