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

-- Tabela de Escalas
create table if not exists schedules (
  id uuid default gen_random_uuid() primary key,
  nurse_id uuid references nurses(id) not null,
  shift_date date not null,
  shift_type text check (shift_type in ('day', 'night')) not null, -- Pode ser expandido para outros códigos
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

-- Inserir Administrador (apenas se não existir)
insert into nurses (name, cpf, password)
select 'Administrador', '02170025367', '123456'
where not exists (select 1 from nurses where cpf = '02170025367');

-- Inserir usuários de teste
insert into nurses (name, cpf, password)
select 'Maria Silva', '111.111.111-11', '123456'
where not exists (select 1 from nurses where cpf = '111.111.111-11');

insert into nurses (name, cpf, password)
select 'João Santos', '222.222.222-22', '123456'
where not exists (select 1 from nurses where cpf = '222.222.222-22');
