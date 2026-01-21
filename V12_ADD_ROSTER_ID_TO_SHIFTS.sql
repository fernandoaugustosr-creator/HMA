-- V12_ADD_ROSTER_ID_TO_SHIFTS.sql
-- Add roster_id to shifts table to support duplicate nurses (Escala Dupla) having separate shifts

DO $$ 
BEGIN 
    -- Check if column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'roster_id') THEN
        ALTER TABLE shifts ADD COLUMN roster_id UUID REFERENCES monthly_rosters(id) ON DELETE CASCADE;
        CREATE INDEX idx_shifts_roster_id ON shifts(roster_id);
    END IF;
END $$;
