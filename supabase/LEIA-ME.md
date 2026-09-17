# Fase 2 — ligar o banco

Passo a passo. Leva uns 10 minutos.

---

## 1. Criar o projeto

1. [supabase.com](https://supabase.com) → **New project**
2. Nome: `painel-whatsapp` · Região: **South America (São Paulo)** — menor latência
3. Guarde a senha do banco que ele pede (é a senha do Postgres, não a do painel)

O plano gratuito serve de sobra para começar.

---

## 2. Criar as tabelas

No projeto: **SQL Editor** → **New query** → cole o conteúdo de
[`schema.sql`](schema.sql) inteiro → **Run**.

Pode rodar de novo quando quiser: o arquivo é idempotente, não duplica nada.

Ele cria `perfis`, `leads`, `mensagens`, `followups`, `eventos` e
`configuracoes`, liga a segurança por linha (RLS) em todas, e instala três
gatilhos:

- conta nova do Auth ganha perfil **pendente** automaticamente (a primeira vira **admin ativo**);
- `atualizado_em` se mantém sozinho;
- **mensagem do lead zera a cadência** — a regra de ouro mora no banco, então vale também para o bridge da Fase 3.

---

## 3. Pegar as chaves

**Project Settings → Data API**:

| Campo no Supabase | Variável |
|---|---|
| Project URL | `VITE_SUPABASE_URL` |
| `anon` `public` | `VITE_SUPABASE_ANON_KEY` |

A chave `anon` é pública por natureza — ela vai no JavaScript do navegador e
não abre nada sozinha. Quem protege os dados é a RLS.

**A chave `service_role` não entra no painel.** Ela ignora a RLS e só pode
viver no backend (o bridge, na Fase 3).

---

## 4. Configurar

**No seu computador:** copie `.env.example` para `.env` e preencha.

**No Netlify:** Site configuration → Environment variables → adicione as duas
com os mesmos nomes → **refaça o deploy** (variáveis só entram no build).

Sem elas o painel continua em modo demonstração, o que é proposital: o site
publicado não quebra enquanto você não terminar esta configuração.

---

## 5. Criar a primeira conta

Abra o painel e use **Criar conta**. A primeira pessoa vira **administradora
ativa** automaticamente — senão não haveria quem liberar ninguém.

As próximas entram como **pendentes**: você libera em **Usuários**, define o
papel e cadastra o número de WhatsApp de cada uma.

### Sobre o e-mail de confirmação

Por padrão o Supabase exige confirmar o e-mail. Para testar mais rápido:
**Authentication → Sign In / Providers → Email** → desligue *Confirm email*.

Em produção, deixe ligado e configure um SMTP próprio
(**Authentication → Emails → SMTP Settings**) — o remetente padrão do Supabase
tem limite baixo e cai em spam.

---

## O que a RLS garante

Não é a interface que esconde os dados; é o banco que recusa. Se alguém abrir
o console do navegador e tentar ler os leads de outra pessoa, o Postgres
devolve vazio.

| Tabela | Operador | Admin |
|---|---|---|
| `perfis` | vê e edita só o próprio (não muda papel nem situação) | tudo |
| `leads` | só onde `responsavel = ele` | tudo (menos apagar, que é só admin) |
| `mensagens` | só dos leads dele | tudo |
| `followups` | só dos leads dele | tudo |
| `eventos` | só os que ele gerou | tudo |
| `configuracoes` | só lê | lê e grava |

Auditoria (`eventos`) não tem política de *update* nem *delete* de propósito:
com RLS ligada, o que não tem política é negado. Ninguém reescreve o histórico.

---

## Conferir se ficou certo

No **SQL Editor**:

```sql
-- todas devem aparecer com rowsecurity = true
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
 order by tablename;

-- as políticas criadas
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;

-- quem já tem acesso
select nome, email, papel, situacao, numero from public.perfis order by criado_em;
```

E no painel: o selo **demonstração** no topo some quando o banco está ligado.

---

## Próximo passo

Fase 3: o bridge do WhatsApp. Ele roda fora do Netlify, conecta uma sessão por
número da equipe, sincroniza etiquetas e mensagens (texto e áudio) e grava
direto nestas tabelas — usando a `service_role`, que só existe lá.
