# Testes do schema

Rodam o `schema.sql` num Postgres local e conferem as regras que a operação
depende. Servem para mexer no banco sem descobrir o estrago em produção.

```powershell
powershell -File supabase\testes\rodar.ps1
```

Precisa de um PostgreSQL rodando em `localhost:5432` com o usuário `postgres`.

| Arquivo | Para que serve |
|---|---|
| `00-ambiente.sql` | Imita o que o Supabase traz pronto: `auth.users`, `auth.uid()`, os papéis `anon`/`authenticated`/`service_role` e a publicação de tempo real. Não vai para produção |
| `01-testes.sql` | As asserções |
| `rodar.ps1` | Recria o banco, aplica tudo e roda |

O `rodar.ps1` aplica o `schema.sql` **duas vezes** de propósito: é o que prova
que ele é idempotente, e não só que foi escrito com a intenção de ser.

O `01-testes.sql` **não** é idempotente: usa ids fixos e exige banco limpo. Por
isso o `rodar.ps1` recria o banco a cada execução.

## O que é conferido

- primeira conta vira admin ativo, as seguintes entram pendentes
- perfil novo ganha linha de sessão automaticamente
- espaçamento entre envios: dentro da faixa, sorteado de fato, primeira sai na hora
- lead diferente no mesmo número também espera; número de outra pessoa não herda a fila
- texto longo repetido para outro lead é recusado, inclusive vindo de outra pessoa da equipe
- mesmo texto para o mesmo lead é permitido; frase curta repetida continua liberada
- regra de ouro: mensagem do lead zera os follow-ups e solta a cadência
- RLS: closer enxerga só os próprios leads e a própria sessão; admin enxerga tudo
- `authenticated` só tem update na coluna `pedido` de `sessoes`
- auditoria e fila não têm policy de update

## Se alguma falhar

O psql para na hora e imprime `FALHOU: <nome do teste>`. O código de saída deixa
de ser zero, então dá para usar em automação.

Vale confirmar de vez em quando que a suíte ainda sabe falhar: acrescente
`select public.conferir('sabotagem', false);` no meio do arquivo e veja se ela
aborta. Bateria que sempre passa não prova nada.
