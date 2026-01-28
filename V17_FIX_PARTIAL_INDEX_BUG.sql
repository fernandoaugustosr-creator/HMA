-- V17_FIX_PARTIAL_INDEX_BUG.sql
-- Este script corrige o erro "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- O erro ocorre porque o índice idx_shifts_roster_date_unique foi criado anteriormente como PARCIAL (com WHERE),
-- mas o comando UPSERT do Supabase requer um índice TOTAL para inferir a constraint de conflito.

-- 1. Remover o índice problemático (seja ele parcial ou não)
DROP INDEX IF EXISTS idx_shifts_roster_date_unique;

-- 2. Recriar o índice SEM a cláusula WHERE (Índice Total)
-- Isso permite que ON CONFLICT (roster_id, date) funcione corretamente
CREATE UNIQUE INDEX idx_shifts_roster_date_unique 
ON shifts(roster_id, date);

-- 3. Garantir que o índice de legado esteja correto também
DROP INDEX IF EXISTS idx_shifts_nurse_date_legacy_unique;
CREATE UNIQUE INDEX idx_shifts_nurse_date_legacy_unique 
ON shifts(nurse_id, date) 
WHERE roster_id IS NULL;
