-- ============================================================================
-- Painel WhatsApp — Goffex School
-- Schema completo + segurança por linha (RLS)
--
-- Como usar: Supabase → SQL Editor → cole este arquivo inteiro → Run.
-- Pode rodar de novo sem medo: tudo é idempotente.
--
-- Regra central: cada pessoa da equipe atende no próprio número e só enxerga
-- os leads dela. Quem é admin enxerga tudo. Isso NÃO é controlado pela
-- interface — é o banco que recusa, o que vale para LGPD.
-- ============================================================================

-- ---------------------------------------------------------------- extensões
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABELAS
-- ============================================================================

-- Espelha auth.users com o que o painel precisa saber sobre a pessoa.
create table if not exists public.perfis (
  id            uuid primary key references auth.users on delete cascade,
  nome          text not null,
  email         text not null unique,
  -- 'operador' aparece como "Closer" na tela; 'sdr' faz a qualificação. A chave
  -- antiga foi mantida para não migrar dado nenhum.
  papel         text not null default 'operador' check (papel in ('admin', 'operador', 'sdr', 'leitor')),
  situacao      text not null default 'pendente' check (situacao in ('pendente', 'ativo', 'bloqueado')),
  -- número de WhatsApp que esta pessoa atende (55 + DDD + número)
  numero        text,
  criado_em     timestamptz not null default now(),
  ultimo_acesso timestamptz
);

comment on table public.perfis is 'Equipe. Conta nova entra como pendente até um admin liberar.';
comment on column public.perfis.numero is 'Número de WhatsApp próprio. É a sessão que a pessoa conecta por QR.';

-- `create table if not exists` não mexe numa tabela que já existe, então a
-- lista de papéis acima não chegaria a quem rodou uma versão anterior deste
-- arquivo. Recriar a restrição resolve, e rodar de novo continua inofensivo.
alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis add constraint perfis_papel_check
  check (papel in ('admin', 'operador', 'sdr', 'leitor'));

-- Leads. A etiqueta vem da retriagem feita dentro do WhatsApp.
create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  responsavel       uuid references public.perfis(id) on delete set null,
  nome              text not null,
  telefone          text not null,
  perfil            text not null default 'iniciante',
  origem            text,
  status            text not null default 'novo'
                    check (status in ('novo', 'em_conversa', 'qualificado', 'proposta', 'cliente', 'perdido')),
  etiquetas         text[] not null default '{}',
  cadencia_pausada  boolean not null default false,
  opt_out           boolean not null default false,
  adiado_ate        timestamptz,
  anotacao          text not null default '',
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  -- o mesmo telefone pode falar com duas pessoas da equipe, em números
  -- diferentes: são duas conversas, não uma duplicata
  unique (responsavel, telefone)
);

comment on column public.leads.etiquetas is 'Etiquetas do WhatsApp Business, sincronizadas pelo bridge.';
comment on column public.leads.opt_out is 'Pediu para não receber mensagens. Bloqueia toda a cadência.';

create index if not exists leads_responsavel_idx on public.leads (responsavel);
create index if not exists leads_status_idx      on public.leads (status);
create index if not exists leads_etiquetas_idx   on public.leads using gin (etiquetas);

-- Mensagens da conversa, texto ou áudio.
create table if not exists public.mensagens (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads on delete cascade,
  -- id da mensagem no WhatsApp: impede duplicar quando o bridge reenvia
  wa_id       text,
  de          text not null check (de in ('lead', 'eu')),
  tipo        text not null default 'texto' check (tipo in ('texto', 'audio', 'imagem', 'documento')),
  texto       text not null default '',
  transcricao text,
  duracao_seg integer,
  midia_url   text,
  em          timestamptz not null default now(),
  unique (lead_id, wa_id)
);

comment on column public.mensagens.transcricao is 'Em áudio é daqui que sai a informação do lead.';

create index if not exists mensagens_lead_idx on public.mensagens (lead_id, em desc);

-- Follow-ups já disparados, por marco da cadência.
create table if not exists public.followups (
  id      uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads on delete cascade,
  dia     integer not null,
  em      timestamptz not null default now(),
  por     uuid references public.perfis(id) on delete set null,
  unique (lead_id, dia)
);

-- Auditoria: quem fez o quê. Dado sensível exige rastro.
create table if not exists public.eventos (
  id      uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads on delete set null,
  usuario uuid references public.perfis(id) on delete set null,
  acao    text not null,
  detalhe text,
  em      timestamptz not null default now()
);

create index if not exists eventos_em_idx on public.eventos (em desc);

-- Configuração da operação (marcos, janela, travas, etiquetas de lead).
create table if not exists public.configuracoes (
  id            integer primary key default 1 check (id = 1),
  dados         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

insert into public.configuracoes (id, dados) values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- ============================================================================
-- FUNÇÕES AUXILIARES
--
-- SECURITY DEFINER de propósito: elas consultam `perfis` por dentro das
-- políticas de `perfis`. Sem isso a RLS entraria em recursão infinita.
-- ============================================================================

create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from public.perfis where id = auth.uid();
$$;

create or replace function public.esta_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select situacao = 'ativo' from public.perfis where id = auth.uid()), false);
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select papel = 'admin' and situacao = 'ativo' from public.perfis where id = auth.uid()),
    false
  );
$$;

-- Pode agir sobre este lead? (é o dono ativo, ou é admin)
create or replace function public.pode_ver_lead(lead_responsavel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.eh_admin() or (public.esta_ativo() and lead_responsavel = auth.uid());
$$;

-- ============================================================================
-- GATILHOS
-- ============================================================================

-- Toda conta nova do Auth ganha um perfil pendente automaticamente.
-- A primeira pessoa a se cadastrar vira admin ativo — senão ninguém libera ninguém.
create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primeiro boolean;
begin
  select count(*) = 0 into primeiro from public.perfis;

  insert into public.perfis (id, nome, email, papel, situacao)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    case when primeiro then 'admin' else 'operador' end,
    case when primeiro then 'ativo' else 'pendente' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- Mantém `atualizado_em` honesto.
create or replace function public.marcar_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists leads_atualizado_em on public.leads;
create trigger leads_atualizado_em
  before update on public.leads
  for each row execute function public.marcar_atualizacao();

-- Regra de ouro: o lead respondeu, a cadência para e zera.
-- Fica no banco, não na interface — assim vale também para o bridge.
create or replace function public.ao_receber_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.de = 'lead' then
    delete from public.followups where lead_id = new.lead_id;

    update public.leads
       set cadencia_pausada = false,
           adiado_ate = null,
           status = case when status = 'novo' then 'novo' else status end
     where id = new.lead_id;
  end if;

  return new;
end;
$$;

drop trigger if exists mensagens_zeram_cadencia on public.mensagens;
create trigger mensagens_zeram_cadencia
  after insert on public.mensagens
  for each row execute function public.ao_receber_mensagem();

-- ============================================================================
-- SEGURANÇA POR LINHA (RLS)
-- ============================================================================

alter table public.perfis         enable row level security;
alter table public.leads          enable row level security;
alter table public.mensagens      enable row level security;
alter table public.followups      enable row level security;
alter table public.eventos        enable row level security;
alter table public.configuracoes  enable row level security;

-- ------------------------------------------------------------------- perfis
drop policy if exists perfis_leitura on public.perfis;
create policy perfis_leitura on public.perfis for select
  using (id = auth.uid() or public.eh_admin());

drop policy if exists perfis_atualiza_proprio on public.perfis;
create policy perfis_atualiza_proprio on public.perfis for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- ninguém promove a si mesmo nem se libera sozinho
    and papel = public.papel_atual()
    and situacao = (select situacao from public.perfis where id = auth.uid())
  );

drop policy if exists perfis_admin_tudo on public.perfis;
create policy perfis_admin_tudo on public.perfis for all
  using (public.eh_admin())
  with check (public.eh_admin());

-- -------------------------------------------------------------------- leads
drop policy if exists leads_leitura on public.leads;
create policy leads_leitura on public.leads for select
  using (public.pode_ver_lead(responsavel));

drop policy if exists leads_insere on public.leads;
create policy leads_insere on public.leads for insert
  with check (public.pode_ver_lead(responsavel));

drop policy if exists leads_atualiza on public.leads;
create policy leads_atualiza on public.leads for update
  using (public.pode_ver_lead(responsavel))
  with check (public.pode_ver_lead(responsavel));

drop policy if exists leads_apaga on public.leads;
create policy leads_apaga on public.leads for delete
  using (public.eh_admin());

-- ---------------------------------------------------------------- mensagens
drop policy if exists mensagens_leitura on public.mensagens;
create policy mensagens_leitura on public.mensagens for select
  using (exists (
    select 1 from public.leads l
     where l.id = mensagens.lead_id and public.pode_ver_lead(l.responsavel)
  ));

drop policy if exists mensagens_insere on public.mensagens;
create policy mensagens_insere on public.mensagens for insert
  with check (exists (
    select 1 from public.leads l
     where l.id = mensagens.lead_id and public.pode_ver_lead(l.responsavel)
  ));

-- ---------------------------------------------------------------- followups
drop policy if exists followups_leitura on public.followups;
create policy followups_leitura on public.followups for select
  using (exists (
    select 1 from public.leads l
     where l.id = followups.lead_id and public.pode_ver_lead(l.responsavel)
  ));

drop policy if exists followups_escreve on public.followups;
create policy followups_escreve on public.followups for all
  using (exists (
    select 1 from public.leads l
     where l.id = followups.lead_id and public.pode_ver_lead(l.responsavel)
  ))
  with check (exists (
    select 1 from public.leads l
     where l.id = followups.lead_id and public.pode_ver_lead(l.responsavel)
  ));

-- ------------------------------------------------------------------ eventos
drop policy if exists eventos_leitura on public.eventos;
create policy eventos_leitura on public.eventos for select
  using (public.eh_admin() or usuario = auth.uid());

drop policy if exists eventos_insere on public.eventos;
create policy eventos_insere on public.eventos for insert
  with check (public.esta_ativo() and usuario = auth.uid());

-- Auditoria não se apaga nem se reescreve. Não existe policy de update/delete
-- de propósito: com RLS ligada, o que não tem policy é negado.

-- ----------------------------------------------------------- configurações
drop policy if exists config_leitura on public.configuracoes;
create policy config_leitura on public.configuracoes for select
  using (public.esta_ativo());

drop policy if exists config_admin on public.configuracoes;
create policy config_admin on public.configuracoes for all
  using (public.eh_admin())
  with check (public.eh_admin());

-- ============================================================================
-- TEMPO REAL
-- Sem isso a fila só se move quando você recarrega a página.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'mensagens'
  ) then
    alter publication supabase_realtime add table public.mensagens;
  end if;
end $$;

-- ============================================================================
-- FASE 3 — A PONTE COM O WHATSAPP
--
-- Decisão de desenho: o banco é o correio entre o painel e o bridge. O bridge
-- não abre porta nenhuma para a internet — ele assina as mudanças daqui e age.
--
-- Isso elimina de uma vez o endpoint público, o CORS, a autenticação da API e
-- o segredo compartilhado. O que não existe não pode ser invadido nem
-- configurado errado. O bridge usa a chave `service_role`, que só vive no
-- servidor dele e passa por cima da RLS.
-- ============================================================================

-- Uma sessão de WhatsApp por pessoa da equipe. O bridge manda o estado e o QR;
-- o painel lê e desenha. O caminho de volta é a coluna `pedido`, única que a
-- pessoa escreve: ela pede, o bridge atende e devolve para 'nenhum'.
create table if not exists public.sessoes (
  perfil_id     uuid primary key references public.perfis on delete cascade,
  numero        text,
  estado        text not null default 'desconectado'
                check (estado in ('desconectado', 'aguardando_qr', 'conectando', 'conectado', 'erro')),
  qr            text,
  erro          text,
  pedido        text not null default 'nenhum'
                check (pedido in ('nenhum', 'conectar', 'desconectar')),
  conectado_em  timestamptz,
  atualizado_em timestamptz not null default now()
);

comment on table public.sessoes is 'Estado da conexão de cada número. Quem escreve estado e QR é o bridge.';
comment on column public.sessoes.qr is 'Válido por poucos segundos. O bridge troca sozinho até alguém ler.';
comment on column public.sessoes.pedido is 'Único campo que a pessoa escreve. O bridge zera depois de atender.';

-- Fila de saída. O painel enfileira, o bridge envia respeitando teto diário,
-- intervalo e horário — as travas que protegem o número de ser banido.
create table if not exists public.fila_envio (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads on delete cascade,
  perfil_id   uuid not null references public.perfis on delete cascade,
  texto       text not null,
  -- qual marco da cadência originou o envio; nulo quando foi resposta manual
  marco       integer,
  status      text not null default 'pendente'
              check (status in ('pendente', 'enviando', 'enviado', 'erro')),
  tentativas  integer not null default 0,
  erro        text,
  criado_por  uuid references public.perfis(id) on delete set null,
  criado_em   timestamptz not null default now(),
  enviado_em  timestamptz
);

comment on table public.fila_envio is 'O painel enfileira aqui; o bridge envia e devolve o resultado.';

create index if not exists fila_envio_pendentes_idx
  on public.fila_envio (status, criado_em) where status = 'pendente';
create index if not exists fila_envio_lead_idx on public.fila_envio (lead_id);

drop trigger if exists sessoes_atualizacao on public.sessoes;
create trigger sessoes_atualizacao before update on public.sessoes
  for each row execute function public.marcar_atualizacao();

-- A linha de sessão nasce junto com o perfil. Assim ninguém precisa criar a
-- própria — e, não podendo criar, também não pode nascer dizendo que já está
-- conectada. Quem descreve o estado é sempre o bridge.
create or replace function public.ao_criar_perfil_abrir_sessao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sessoes (perfil_id, numero)
  values (new.id, new.numero)
  on conflict (perfil_id) do nothing;
  return new;
end;
$$;

drop trigger if exists perfil_abre_sessao on public.perfis;
create trigger perfil_abre_sessao after insert on public.perfis
  for each row execute function public.ao_criar_perfil_abrir_sessao();

-- Quem já existia antes desta seção também ganha a sua.
insert into public.sessoes (perfil_id, numero)
select id, numero from public.perfis
on conflict (perfil_id) do nothing;

-- ------------------------------------------------------------------- RLS

alter table public.sessoes    enable row level security;
alter table public.fila_envio enable row level security;

drop policy if exists sessoes_leitura on public.sessoes;
create policy sessoes_leitura on public.sessoes for select
  using (perfil_id = auth.uid() or public.eh_admin());

-- Ninguém vê o QR de outra pessoa: ler o QR alheio é entrar no WhatsApp dela.
-- Por isso admin enxerga o estado de todo mundo, mas a leitura acima é a única
-- porta, e o painel só mostra o QR na tela de quem é dono da sessão.

drop policy if exists sessoes_pede on public.sessoes;
create policy sessoes_pede on public.sessoes for update
  using (perfil_id = auth.uid() and public.esta_ativo())
  with check (perfil_id = auth.uid());

-- A política acima libera a linha; o privilégio abaixo limita a coluna. Sem
-- ele, a pessoa poderia escrever `estado = 'conectado'` e mentir para a
-- própria tela. Quem diz o estado é o bridge, e só ele.
revoke update on public.sessoes from anon, authenticated;
grant  update (pedido) on public.sessoes to authenticated;

-- Não existe policy de insert nem de delete: a linha nasce e morre junto com o
-- perfil, pelo gatilho acima. O que não tem policy é negado.

drop policy if exists fila_leitura on public.fila_envio;
create policy fila_leitura on public.fila_envio for select
  using (public.pode_ver_lead(perfil_id));

drop policy if exists fila_insere on public.fila_envio;
create policy fila_insere on public.fila_envio for insert
  with check (
    public.pode_ver_lead(perfil_id)
    and exists (select 1 from public.leads l where l.id = lead_id and public.pode_ver_lead(l.responsavel))
  );

-- Dá para cancelar o que ainda não saiu. Depois de enviado não se apaga: a
-- mensagem já está no celular do lead, e o histórico tem que refletir isso.
drop policy if exists fila_cancela on public.fila_envio;
create policy fila_cancela on public.fila_envio for delete
  using (public.pode_ver_lead(perfil_id) and status = 'pendente');

-- Quem marca 'enviado' ou 'erro' é o bridge. Não existe policy de update de
-- propósito: com RLS ligada, o que não tem policy é negado.

-- ------------------------------------------------------------- tempo real

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'sessoes'
  ) then
    alter publication supabase_realtime add table public.sessoes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'fila_envio'
  ) then
    alter publication supabase_realtime add table public.fila_envio;
  end if;
end $$;

-- ----------------------------------------------------- espaçamento de envio
--
-- Nenhuma mensagem sai colada na anterior. O horário mínimo de cada envio é
-- decidido quando a linha entra na fila, não na hora de enviar — então clicar
-- dez vezes cria dez linhas já espalhadas, em vez de dez disparos para o
-- bridge segurar depois.
--
-- Mora no banco de propósito. No código do bridge isto seria uma promessa de
-- comportamento: sumiria num bug, num reinício no meio da fila ou no dia em
-- que duas instâncias subissem por engano. Aqui é a transação que garante.
--
-- O espaçamento vale por número, não por lead: duas conversas diferentes no
-- mesmo WhatsApp continuam sendo o mesmo número aos olhos de quem bane.

alter table public.fila_envio
  add column if not exists nao_antes_de timestamptz not null default now();

comment on column public.fila_envio.nao_antes_de is
  'Horário mínimo de saída, calculado na entrada da fila. O bridge nunca envia antes.';

create index if not exists fila_envio_proxima_idx
  on public.fila_envio (perfil_id, nao_antes_de) where status = 'pendente';

create or replace function public.espacar_envio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  espaco integer;
  ultimo timestamptz;
begin
  -- Trava a sessão de quem envia. Sem isso, dois cliques simultâneos leriam a
  -- mesma "última saída" e marcariam o mesmo horário — que é exatamente o
  -- disparo em rajada que esta função existe para impedir.
  perform 1 from public.sessoes where perfil_id = new.perfil_id for update;

  espaco := coalesce(
    (select (dados->>'intervaloMinSegundos')::integer from public.configuracoes where id = 1),
    45
  );

  -- Piso, não sugestão: a configuração pode ser mais conservadora, nunca menos.
  -- Afrouxar daqui para baixo é o caminho mais curto para perder o número.
  if espaco is null or espaco < 30 then
    espaco := 30;
  end if;

  select max(nao_antes_de) into ultimo
    from public.fila_envio
   where perfil_id = new.perfil_id
     and status <> 'erro';

  -- Sem predecessora, sai agora: espaçamento é entre uma mensagem e outra, e a
  -- primeira não tem outra. Segurar a primeira só atrasaria a resposta de quem
  -- acabou de escrever, sem reduzir risco nenhum.
  new.nao_antes_de := case
    when ultimo is null then now()
    else greatest(now(), ultimo + make_interval(secs => espaco))
  end;

  return new;
end;
$$;

drop trigger if exists fila_espaca on public.fila_envio;
create trigger fila_espaca before insert on public.fila_envio
  for each row execute function public.espacar_envio();
