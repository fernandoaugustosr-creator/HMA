-- V14_ALLOW_DUPLICATE_SHIFTS.sql
-- Versão Simplificada (Sem blocos PL/pgSQL complexos para evitar erros de sintaxe)
-- Rode este script no Editor SQL do Supabase

-- 1. Tentar remover constraints antigas (Se existirem)
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_nurse_id_shift_date_key;
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_nurse_id_date_key;
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_nurse_id_key; -- Possível nome genérico

-- 2. Remover índices antigos que possam causar unicidade indesejada
DROP INDEX IF EXISTS idx_shifts_nurse_date_unique;
DROP INDEX IF EXISTS idx_shifts_roster_date_unique; -- Remove para recriar corretamente abaixo

-- 3. Criar novos Índices Parciais para garantir a lógica correta
-- Caso A: Turnos vinculados a uma escala (unicidade por roster_id + date)
-- Permite que o mesmo enfermeiro tenha turnos no mesmo dia SE forem em escalas (rosters) diferentes
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_roster_date_unique 
ON shifts(roster_id, date) 
WHERE roster_id IS NOT NULL;

-- Caso B: Turnos Legado/Sem escala (unicidade por nurse_id + date)
-- Mantém compatibilidade com dados antigos
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_nurse_date_legacy_unique 
ON shifts(nurse_id, date) 
WHERE roster_id IS NULL;
