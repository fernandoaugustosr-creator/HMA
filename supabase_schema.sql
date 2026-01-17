-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: schedule_sections
CREATE TABLE IF NOT EXISTS schedule_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Table: units
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Table: nurses
CREATE TABLE IF NOT EXISTS nurses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    password TEXT DEFAULT '123456',
    coren TEXT,
    vinculo TEXT,
    role TEXT DEFAULT 'ENFERMEIRO',
    section_id UUID REFERENCES schedule_sections(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Table: shifts
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type TEXT NOT NULL, -- 'D', 'N', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Table: monthly_rosters
CREATE TABLE IF NOT EXISTS monthly_rosters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
    section_id UUID REFERENCES schedule_sections(id),
    unit_id UUID REFERENCES units(id),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    observation TEXT,
    sector TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Table: time_off_requests
CREATE TABLE IF NOT EXISTS time_off_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    type TEXT, -- 'ferias', 'licenca_saude', etc.
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_nurse ON shifts(nurse_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_status ON time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_dates ON time_off_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_monthly_rosters_month_year_unit ON monthly_rosters(month, year, unit_id);

-- Table: shift_swaps
CREATE TABLE IF NOT EXISTS shift_swaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
    requested_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
    requester_shift_date DATE NOT NULL,
    requested_shift_date DATE,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insert default sections
INSERT INTO schedule_sections (title, position) VALUES
('ENFERMEIROS', 1),
('TÉCNICOS DE ENFERMAGEM', 2),
('TÉCNICOS DE ENFERMAGEM-DIURNO', 3),
('TÉCNICOS DE ENFERMAGEM-NEONATOLOGIA', 4)
ON CONFLICT DO NOTHING;

-- Insert default units
INSERT INTO units (title) VALUES
('POSTO 1'),
('POSTO 2'),
('NEONATOLOGIA E PEDIATRIA')
ON CONFLICT DO NOTHING;

-- Enable RLS and Create Policies (Public Access for now to ensure functionality)
-- Schedule Sections
ALTER TABLE schedule_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access schedule_sections" ON schedule_sections;
CREATE POLICY "Public access schedule_sections" ON schedule_sections FOR ALL USING (true) WITH CHECK (true);

-- Units
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access units" ON units;
CREATE POLICY "Public access units" ON units FOR ALL USING (true) WITH CHECK (true);

-- Nurses
ALTER TABLE nurses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access nurses" ON nurses;
CREATE POLICY "Public access nurses" ON nurses FOR ALL USING (true) WITH CHECK (true);

-- Shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access shifts" ON shifts;
CREATE POLICY "Public access shifts" ON shifts FOR ALL USING (true) WITH CHECK (true);

-- Monthly Rosters
ALTER TABLE monthly_rosters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access monthly_rosters" ON monthly_rosters;
CREATE POLICY "Public access monthly_rosters" ON monthly_rosters FOR ALL USING (true) WITH CHECK (true);

-- Time Off Requests
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access time_off_requests" ON time_off_requests;
CREATE POLICY "Public access time_off_requests" ON time_off_requests FOR ALL USING (true) WITH CHECK (true);

-- Shift Swaps
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access shift_swaps" ON shift_swaps;
CREATE POLICY "Public access shift_swaps" ON shift_swaps FOR ALL USING (true) WITH CHECK (true);
