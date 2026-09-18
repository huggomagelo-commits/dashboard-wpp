-- ============================================================================
-- Testes do schema. Cada bloco confere uma regra que a operação depende.
-- Falha alguma coisa -> o script aborta com a mensagem do que quebrou e o psql
-- sai com código diferente de zero.
--
-- Uso:  powershell -File rodar.ps1
--
-- Ao contrário do schema.sql, ESTE arquivo não é idempotente: ele insere
-- usuários e leads com ids fixos, então exige banco limpo. Rodar duas vezes no
-- mesmo banco falha na chave primária — o `rodar.ps1` recria o banco por isso.
-- ============================================================================

\set ON_ERROR_STOP on
-- `notice` e não `warning`: é em notice que cada "ok" aparece. Silenciar aqui
-- faria a suíte terminar dizendo que passou tudo sem mostrar um teste sequer —
-- indistinguível de não ter rodado nada.
set client_min_messages to notice;

create or replace function public.conferir(nome text, condicao boolean)
returns void
language plpgsql
as $$
begin
  if condicao then
    raise notice 'ok    %', nome;
  else
    raise exception 'FALHOU: %', nome;
  end if;
end;
$$;

-- ---------------------------------------------------------------- preparo

-- Três contas: uma vira admin (a primeira), as outras entram pendentes.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'admin@teste.com', '{"nome":"Admin"}'),
  ('22222222-2222-2222-2222-222222222222', 'ana@teste.com',   '{"nome":"Ana"}'),
  ('33333333-3333-3333-3333-333333333333', 'bruno@teste.com', '{"nome":"Bruno"}');

select public.conferir(
  'primeira conta vira admin ativo',
  (select papel = 'admin' and situacao = 'ativo' from public.perfis
    where id = '11111111-1111-1111-1111-111111111111')
);

select public.conferir(
  'segunda conta entra pendente',
  (select situacao = 'pendente' from public.perfis
    where id = '22222222-2222-2222-2222-222222222222')
);

update public.perfis set situacao = 'ativo', numero = '5511999990002'
  where id = '22222222-2222-2222-2222-222222222222';
update public.perfis set situacao = 'ativo', numero = '5511999990003'
  where id = '33333333-3333-3333-3333-333333333333';

select public.conferir(
  'perfil novo ganha linha de sessao automaticamente',
  (select count(*) = 3 from public.sessoes)
);

insert into public.leads (id, responsavel, nome, telefone) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Lead Um',   '5511900000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Lead Dois', '5511900000002'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Lead Tres', '5511900000003');

-- ------------------------------------------------- espacamento entre envios

-- Dez mensagens no mesmo instante, mesmo numero.
do $$
declare i integer;
begin
  for i in 1..10 loop
    insert into public.fila_envio (lead_id, perfil_id, texto)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '22222222-2222-2222-2222-222222222222',
            'mensagem curta ' || i);
  end loop;
end $$;

select public.conferir(
  'primeira mensagem sai na hora',
  (select min(nao_antes_de) <= now() + interval '1 second' from public.fila_envio)
);

with ordenadas as (
  select nao_antes_de,
         lag(nao_antes_de) over (order by nao_antes_de) as anterior
    from public.fila_envio
   where perfil_id = '22222222-2222-2222-2222-222222222222'
),
intervalos as (
  select extract(epoch from (nao_antes_de - anterior)) as seg
    from ordenadas where anterior is not null
)
select
  public.conferir('nenhum intervalo abaixo de 27s', (select min(seg) >= 27 from intervalos)),
  public.conferir('nenhum intervalo acima de 48s', (select max(seg) <= 48 from intervalos)),
  -- Se o sorteio funciona, os intervalos nao sao todos iguais. Com 9 amostras
  -- em 22 valores possiveis, sair tudo igual por acaso e praticamente zero.
  public.conferir('intervalo e sorteado, nao fixo', (select count(distinct seg) > 1 from intervalos));

-- Lead diferente, mesmo numero: o espacamento continua valendo.
insert into public.fila_envio (lead_id, perfil_id, texto)
values ('aaaaaaaa-0000-0000-0000-000000000002',
        '22222222-2222-2222-2222-222222222222', 'outro lead, mesmo numero');

select public.conferir(
  'lead diferente no mesmo numero tambem espera',
  (select count(*) = 0 from (
     select nao_antes_de, lag(nao_antes_de) over (order by nao_antes_de) as ant
       from public.fila_envio where perfil_id = '22222222-2222-2222-2222-222222222222'
   ) t where ant is not null and extract(epoch from (nao_antes_de - ant)) < 27)
);

-- Numero de outra pessoa nao herda a fila.
insert into public.fila_envio (lead_id, perfil_id, texto)
values ('bbbbbbbb-0000-0000-0000-000000000003',
        '33333333-3333-3333-3333-333333333333', 'primeira do bruno');

select public.conferir(
  'numero de outra pessoa sai na hora',
  (select nao_antes_de <= now() + interval '1 second' from public.fila_envio
    where perfil_id = '33333333-3333-3333-3333-333333333333')
);

-- ------------------------------------------------------- texto nao repetido

do $$
declare
  longo text := repeat('follow-up longo o suficiente para contar como modelo. ', 3);
  deu_erro boolean := false;
begin
  insert into public.fila_envio (lead_id, perfil_id, texto)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '22222222-2222-2222-2222-222222222222', longo);

  begin
    insert into public.fila_envio (lead_id, perfil_id, texto)
    values ('aaaaaaaa-0000-0000-0000-000000000002',
            '22222222-2222-2222-2222-222222222222', longo);
  exception when check_violation then
    deu_erro := true;
  end;

  perform public.conferir('texto longo repetido para outro lead e recusado', deu_erro);

  -- Mesmo lead pode receber o mesmo texto de novo (reenvio legitimo).
  deu_erro := false;
  begin
    insert into public.fila_envio (lead_id, perfil_id, texto)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '22222222-2222-2222-2222-222222222222', longo);
  exception when check_violation then
    deu_erro := true;
  end;
  perform public.conferir('mesmo texto para o mesmo lead e permitido', not deu_erro);

  -- Frase curta repetida e conversa normal, nao disparo em massa.
  deu_erro := false;
  begin
    insert into public.fila_envio (lead_id, perfil_id, texto)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '22222222-2222-2222-2222-222222222222', 'bom dia!');
    insert into public.fila_envio (lead_id, perfil_id, texto)
    values ('aaaaaaaa-0000-0000-0000-000000000002',
            '22222222-2222-2222-2222-222222222222', 'bom dia!');
  exception when check_violation then
    deu_erro := true;
  end;
  perform public.conferir('frase curta repetida continua liberada', not deu_erro);

  -- E de outra pessoa da equipe tambem nao pode repetir o modelo.
  deu_erro := false;
  begin
    insert into public.fila_envio (lead_id, perfil_id, texto)
    values ('bbbbbbbb-0000-0000-0000-000000000003',
            '33333333-3333-3333-3333-333333333333', longo);
  exception when check_violation then
    deu_erro := true;
  end;
  perform public.conferir('outra pessoa da equipe tambem nao repete o modelo', deu_erro);
end $$;

-- ---------------------------------------------------------- regra de ouro

insert into public.followups (lead_id, dia) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 2),
  ('aaaaaaaa-0000-0000-0000-000000000001', 3);

update public.leads set cadencia_pausada = true, adiado_ate = now() + interval '3 days'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';

insert into public.mensagens (lead_id, de, texto)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'lead', 'oi, ainda tenho interesse');

select public.conferir(
  'mensagem do lead zera os follow-ups',
  (select count(*) = 0 from public.followups
    where lead_id = 'aaaaaaaa-0000-0000-0000-000000000001')
);

select public.conferir(
  'mensagem do lead solta a cadencia',
  (select cadencia_pausada = false and adiado_ate is null from public.leads
    where id = 'aaaaaaaa-0000-0000-0000-000000000001')
);

-- --------------------------------------------------------------- RLS

-- `set local` fora de transacao nao faz nada no psql: cada comando roda na
-- propria transacao implicita e o ajuste morre junto. Aqui e `set` de sessao.

-- Ana enxerga os leads dela e nao os do Bruno.
set "teste.usuario" = '22222222-2222-2222-2222-222222222222';
set role authenticated;

select public.conferir(
  'closer enxerga so os proprios leads',
  (select count(*) = 2 from public.leads)
);

select public.conferir(
  'closer enxerga so a propria sessao',
  (select count(*) = 1 from public.sessoes)
);

reset role;
set "teste.usuario" = '11111111-1111-1111-1111-111111111111';
set role authenticated;

select public.conferir(
  'admin enxerga todos os leads',
  (select count(*) = 3 from public.leads)
);

reset role;

-- Privilegio de coluna: a pessoa so escreve `pedido` na propria sessao.
select public.conferir(
  'authenticated so tem update na coluna pedido de sessoes',
  (select count(*) = 1 from information_schema.column_privileges
    where grantee = 'authenticated' and table_name = 'sessoes' and privilege_type = 'UPDATE')
    and (select column_name = 'pedido' from information_schema.column_privileges
          where grantee = 'authenticated' and table_name = 'sessoes' and privilege_type = 'UPDATE')
);

-- Auditoria nao se reescreve: nao existe policy de update nem de delete.
select public.conferir(
  'eventos nao tem policy de update nem delete',
  (select count(*) = 0 from pg_policies
    where tablename = 'eventos' and cmd in ('UPDATE', 'DELETE'))
);

select public.conferir(
  'fila_envio nao tem policy de update',
  (select count(*) = 0 from pg_policies where tablename = 'fila_envio' and cmd = 'UPDATE')
);

-- ------------------------------------------------------------- estrutura

select public.conferir(
  'RLS ligada nas oito tabelas',
  (select count(*) = 8 from pg_tables
    where schemaname = 'public' and rowsecurity = true)
);

select public.conferir(
  'papel sdr aceito',
  (select count(*) = 1 from pg_constraint
    where conname = 'perfis_papel_check' and pg_get_constraintdef(oid) like '%sdr%')
);

\echo ''
\echo '================================'
\echo ' Todos os testes passaram.'
\echo '================================'
