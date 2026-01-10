-- Tabela de Enfermeiros (Segura para rodar múltiplas vezes)
create table if not exists nurses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  cpf text unique not null,
  password text not null, -- Em produção, use hash!
  coren text,
  role text default 'ENFERMEIRO', -- 'ENFERMEIRO', 'TECNICO', etc.
  vinculo text, -- 'CONCURSO', 'SELETIVO', etc.
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Escalas (Turnos Diários)
create table if not exists schedules (
  id uuid default gen_random_uuid() primary key,
  nurse_id uuid references nurses(id) not null,
  shift_date date not null,
  shift_type text check (shift_type in ('day', 'night', 'morning', 'afternoon')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Solicitações de Folga / Licenças
create table if not exists time_off_requests (
  id uuid default gen_random_uuid() primary key,
  nurse_id uuid references nurses(id) not null,
  start_date date not null,
  end_date date not null,
  reason text,
  type text default 'folga', -- 'folga', 'ferias', 'licenca_saude', 'licenca_maternidade', 'cessao'
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Seções/Blocos da Escala
create table if not exists schedule_sections (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  position serial,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Setores/Unidades
create table if not exists units (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Lotação Mensal (Monthly Roster)
-- Define quais enfermeiros estão em qual setor/seção num mês específico
create table if not exists monthly_rosters (
  id uuid default gen_random_uuid() primary key,
  nurse_id uuid references nurses(id) not null,
  unit_id uuid references units(id),
  section_id uuid references schedule_sections(id) not null,
  month integer not null,
  year integer not null,
  observation text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(nurse_id, month, year) -- Um enfermeiro só pode estar em um lugar por mês (regra simplificada)
);

-- Adicionar colunas legadas em nurses (mantidas para compatibilidade ou default)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'nurses' and column_name = 'section_id') then
        alter table nurses add column section_id uuid references schedule_sections(id);
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'nurses' and column_name = 'unit_id') then
        alter table nurses add column unit_id uuid references units(id);
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'nurses' and column_name = 'role') then
        alter table nurses add column role text default 'ENFERMEIRO';
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'nurses' and column_name = 'vinculo') then
        alter table nurses add column vinculo text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'nurses' and column_name = 'coren') then
        alter table nurses add column coren text;
    end if;
end $$;

-- Inserir Administrador (apenas se não existir)
insert into nurses (name, cpf, password)
select 'Administrador', '02170025367', '123456'
where not exists (select 1 from nurses where cpf = '02170025367');

-- Inserir seções padrão
insert into schedule_sections (title, position)
select 'ENFERMEIROS', 1
where not exists (select 1 from schedule_sections where title = 'ENFERMEIROS');

insert into schedule_sections (title, position)
select 'TÉCNICOS DE ENFERMAGEM', 2
where not exists (select 1 from schedule_sections where title = 'TÉCNICOS DE ENFERMAGEM');

-- Inserir unidades padrão
insert into units (title)
select 'POSTO 1'
where not exists (select 1 from units where title = 'POSTO 1');

insert into units (title)
select 'POSTO 2'
where not exists (select 1 from units where title = 'POSTO 2');

-- Atualizar enfermeiros existentes para a seção correta (apenas defaults)
update nurses set section_id = (select id from schedule_sections where title = 'ENFERMEIROS')
where role = 'ENFERMEIRO' and section_id is null;

update nurses set section_id = (select id from schedule_sections where title = 'TÉCNICOS DE ENFERMAGEM')
where role = 'TECNICO' and section_id is null;
