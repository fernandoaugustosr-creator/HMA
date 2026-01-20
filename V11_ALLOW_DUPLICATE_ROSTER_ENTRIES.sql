-- Remove unique constraint from monthly_rosters to allow Double Shifts (Escala Dupla)
ALTER TABLE monthly_rosters DROP CONSTRAINT IF EXISTS monthly_rosters_nurse_id_month_year_key;

-- Also drop index if it exists explicitly (though dropping constraint usually drops the index backing it)
DROP INDEX IF EXISTS idx_monthly_rosters_month_year_unit; -- This is not unique, so keep it.
-- The unique index was likely created implicitly by the UNIQUE constraint.
