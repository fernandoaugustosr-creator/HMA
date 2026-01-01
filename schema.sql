-- Tabela de Enfermeiros
create table nurses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Escalas
create table schedules (
  id uuid default gen_random_uuid() primary key,
  nurse_id uuid references nurses(id) not null,
  shift_date date not null,
  shift_type text check (shift_type in ('day', 'night')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Inserir alguns dados de exemplo
insert into nurses (name) values ('Maria Silva'), ('João Santos'), ('Ana Oliveira');
