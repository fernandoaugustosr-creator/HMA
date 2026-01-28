-- Tabela de Logs de Login
CREATE TABLE IF NOT EXISTS login_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES nurses(id) ON DELETE SET NULL,
    user_name TEXT,
    user_role TEXT,
    login_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

-- Policy
DROP POLICY IF EXISTS "Public access login_logs" ON login_logs;
CREATE POLICY "Public access login_logs" ON login_logs FOR ALL USING (true) WITH CHECK (true);
