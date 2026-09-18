-- ============================================================================
-- Imita o que o Supabase traz pronto, para o schema.sql rodar num Postgres
-- comum. Não vai para produção: lá essas peças já existem.
--
-- Uso:  psql -f 00-ambiente.sql -f ../schema.sql -f 01-testes.sql
-- ============================================================================

-- Os papéis que o Supabase cria. O schema dá grant e revoke neles.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;

create schema if not exists auth;

-- Só as colunas que o nosso gatilho de criação de perfil lê.
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- No Supabase, auth.uid() é quem está logado. Aqui é uma variável de sessão,
-- para os testes poderem trocar de usuário e conferir a RLS de cada papel.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('teste.usuario', true), '')::uuid;
$$;

-- A publicação de tempo real que o schema estende no fim.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
