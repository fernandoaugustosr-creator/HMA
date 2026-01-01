-- Tabela de Enfermeiros (Atualizada)
-- Se a tabela já existir, você pode rodar apenas os comandos ALTER TABLE abaixo
-- ALTER TABLE nurses ADD COLUMN cpf text UNIQUE;
-- ALTER TABLE nurses ADD COLUMN password text;

drop table if exists schedules;
drop table if exists nurses;

create table nurses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  cpf text unique not null,
  password text not null, -- Em produção, use hash!
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

-- Inserir dados de exemplo (CPF e Senha fictícios)
-- Senha padrão para testes: "123456"
insert into nurses (name, cpf, password) values 
('Administrador', '02170025367', '123456'),
('Maria Silva', '111.111.111-11', '123456'), 
('João Santos', '222.222.222-22', '123456'), 
('Ana Oliveira', '333.333.333-33', '123456');

-- Inserir escalas de exemplo
insert into schedules (nurse_id, shift_date, shift_type) 
select id, '2026-01-01', 'day' from nurses where name = 'Maria Silva';

insert into schedules (nurse_id, shift_date, shift_type) 
select id, '2026-01-01', 'night' from nurses where name = 'João Santos';
