-- V19_FIX_SAVING_AND_DUPLICATES.sql
-- Este script remove restrições que impedem a Escala Dupla e garante que o salvamento seja estável.

-- 1. Remover restrição de unicidade que impede o mesmo enfermeiro de estar no roster várias vezes (Escala Dupla)
ALTER TABLE monthly_rosters DROP CONSTRAINT IF EXISTS monthly_rosters_nurse_id_month_year_key;

-- 2. Limpar índices antigos da tabela shifts que podem causar conflitos (idx_shifts_nurse_date_unique etc.)
DROP INDEX IF EXISTS idx_shifts_nurse_date_unique;
DROP INDEX IF EXISTS shifts_nurse_id_date_idx;
DROP INDEX IF EXISTS shifts_nurse_id_shift_date_idx;

-- 3. Garantir unicidade por (roster_id, date) - ESSENCIAL PARA ESCALA DUPLA
-- Isso permite que o mesmo enfermeiro tenha dois plantões no mesmo dia, desde que em rostos (linhas) diferentes.
DROP INDEX IF EXISTS idx_shifts_roster_date_unique;
CREATE UNIQUE INDEX idx_shifts_roster_date_unique ON shifts(roster_id, date);

-- 4. Garantir unicidade para plantões legados (onde roster_id é NULL)
DROP INDEX IF EXISTS idx_shifts_nurse_date_legacy_unique;
CREATE UNIQUE INDEX idx_shifts_nurse_date_legacy_unique ON shifts(nurse_id, date) WHERE roster_id IS NULL;

-- 5. Adicionar índice de performance para busca de plantões por mês
CREATE INDEX IF NOT EXISTS idx_shifts_date_performance ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_nurse_performance ON shifts(nurse_id);
CREATE INDEX IF NOT EXISTS idx_shifts_roster_performance ON shifts(roster_id);
