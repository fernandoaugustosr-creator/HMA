-- Remover a restrição de unicidade apenas no CPF
-- Primeiro, precisamos descobrir o nome da constraint. Geralmente é "nurses_cpf_key".
-- Vamos tentar remover genericamente.

DO $$
BEGIN
    -- Tenta remover a constraint nurses_cpf_key se existir
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nurses_cpf_key') THEN
        ALTER TABLE nurses DROP CONSTRAINT nurses_cpf_key;
    END IF;
    
    -- Se houver um índice único criado implicitamente, ele geralmente vai embora com a constraint.
    -- Mas podemos garantir removendo o índice se ele existir separadamente e for único.
    -- (Opcional, pois DROP CONSTRAINT remove o índice associado se foi criado pela constraint)
END $$;

-- Agora adicionamos uma constraint composta: CPF + Vínculo deve ser único.
-- Isso permite o mesmo CPF com vínculos diferentes (ex: Concurso e Seletivo),
-- mas impede dois registros idênticos (mesmo CPF e mesmo Vínculo).
ALTER TABLE nurses 
ADD CONSTRAINT nurses_cpf_vinculo_key UNIQUE (cpf, vinculo);

-- Criar um índice simples no CPF para manter a busca rápida
CREATE INDEX IF NOT EXISTS idx_nurses_cpf ON nurses(cpf);
