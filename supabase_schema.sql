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
