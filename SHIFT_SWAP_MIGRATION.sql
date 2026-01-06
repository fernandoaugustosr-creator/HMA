-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create shift_swaps table
CREATE TABLE IF NOT EXISTS shift_swaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
    requested_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
    requester_shift_date DATE NOT NULL,
    requested_shift_date DATE,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;

-- Create Policy for public access (or authenticated access)
-- For simplicity and consistency with other tables in this codebase:
DROP POLICY IF EXISTS "Public access shift_swaps" ON shift_swaps;
CREATE POLICY "Public access shift_swaps" ON shift_swaps FOR ALL USING (true) WITH CHECK (true);
