-- Add sector column to monthly_rosters
ALTER TABLE monthly_rosters ADD COLUMN IF NOT EXISTS sector TEXT;
