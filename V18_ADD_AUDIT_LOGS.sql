-- V18_ADD_AUDIT_LOGS.sql
-- Este script cria a tabela de auditoria para rastrear mudanças na escala.

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES nurses(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL, -- 'UPSERT_SHIFT', 'DELETE_SHIFT', 'CLEAR_MONTH'
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de acesso (apenas admins podem ver, todos podem inserir)
CREATE POLICY "Public can insert audit_logs" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view audit_logs" ON audit_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM nurses 
        WHERE nurses.id = (SELECT (current_setting('request.jwt.claims', true)::jsonb)->>'sub')::uuid
        AND (nurses.role = 'ADMIN' OR nurses.role = 'COORDENACAO_GERAL')
    )
);
