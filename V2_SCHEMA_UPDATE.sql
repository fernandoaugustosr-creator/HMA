-- SCRIPT DE REVISÃO E ATUALIZAÇÃO DO BANCO DE DADOS (V2.1)
-- Este script garante que todas as tabelas, colunas e índices necessários existam.
-- Rode este script no Editor SQL do Supabase.

-- ==============================================================================
-- 1. ESTRUTURA BASE (Tabelas Principais)
-- ==============================================================================

-- Tabela de Seções/Blocos (Ex: Enfermeiros, Técnicos)
create table if not exists schedule_sections (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  position serial,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Setores/Unidades (Ex: Posto 1, Posto 2)
create table if not exists units (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Lotação Mensal (Define onde o enfermeiro está em cada mês)
create table if not exists monthly_rosters (
  id uuid default gen_random_uuid() primary key,
  nurse_id uuid references nurses(id) not null,
  unit_id uuid references units(id),
  section_id uuid references schedule_sections(id) not null,
  month integer not null,
  year integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(nurse_id, month, year)
);

-- ==============================================================================
-- 2. ATUALIZAÇÃO DE COLUNAS (Tabela Nurses)
-- ==============================================================================

do $$
begin
    -- Adicionar coluna section_id se não existir
    if not exists (select 1 from information_schema.columns where table_name = 'nurses' and column_name = 'section_id') then
        alter table nurses add column section_id uuid references schedule_sections(id);
    end if;

    -- Adicionar coluna unit_id se não existir
    if not exists (select 1 from information_schema.columns where table_name = 'nurses' and column_name = 'unit_id') then
        alter table nurses add column unit_id uuid references units(id);
    end if;
    
    -- Garantir que role existe
    if not exists (select 1 from information_schema.columns where table_name = 'nurses' and column_name = 'role') then
        alter table nurses add column role text default 'ENFERMEIRO';
    end if;
end $$;

-- ==============================================================================
-- 3. OTIMIZAÇÃO DE PERFORMANCE (Índices)
-- ==============================================================================

-- Índices para deixar o carregamento da escala mais rápido
create index if not exists idx_monthly_rosters_month_year on monthly_rosters(month, year);
create index if not exists idx_monthly_rosters_nurse on monthly_rosters(nurse_id);
create index if not exists idx_shifts_date on shifts(date);
create index if not exists idx_shifts_nurse on shifts(nurse_id);
create index if not exists idx_nurses_section on nurses(section_id);

-- ==============================================================================
-- 4. DADOS PADRÃO (Garante que não fique vazio)
-- ==============================================================================

-- Seções Padrão
insert into schedule_sections (title, position)
select 'ENFERMEIROS', 1
where not exists (select 1 from schedule_sections where title = 'ENFERMEIROS');

insert into schedule_sections (title, position)
select 'TÉCNICOS DE ENFERMAGEM', 2
where not exists (select 1 from schedule_sections where title = 'TÉCNICOS DE ENFERMAGEM');

-- Unidades Padrão
insert into units (title)
select 'POSTO 1'
where not exists (select 1 from units where title = 'POSTO 1');

insert into units (title)
select 'POSTO 2'
where not exists (select 1 from units where title = 'POSTO 2');

-- ==============================================================================
-- 5. LIMPEZA DE CACHE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';
