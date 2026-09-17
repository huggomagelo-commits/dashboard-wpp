# Painel WhatsApp

Dashboard de gestão de leads do WhatsApp: quem precisa de resposta agora, quem chegou
hoje e quem precisa de follow-up. Preto e azul, responsivo, instalável no celular.

**Produto atendido:** Goffex School — mentoria de R$ 1.297 (pagamento único) que ensina
afiliação de produtos físicos (nutracêuticos) com tráfego pago, IA e WhatsApp.

**Escopo deste painel:** só leads que chegaram ao **WhatsApp**. Quem preenche o formulário
do anúncio e não puxa conversa fica no outro dashboard, não aqui.

**Equipe:** cada pessoa atende no **próprio número**, conecta a própria sessão e trabalha a
própria fila. Quem administra pode alternar entre "Meus leads" e "Toda a equipe" no topo.

## Dois modos

O painel roda em dois modos, e a interface é a mesma nos dois:

| | Quando | Dados | Login |
|---|---|---|---|
| **Demonstração** | sem as variáveis de ambiente | exemplo, no navegador | faz de conta |
| **Supabase** | com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` | banco real, protegido por RLS | de verdade |

Um selo **demonstração** aparece no topo quando não há banco ligado. Para ligar, siga
[`supabase/LEIA-ME.md`](supabase/LEIA-ME.md) — leva uns 10 minutos.

A conexão com o WhatsApp ainda não existe em nenhum dos dois modos: ela entra na Fase 3.

---

## Rodar na sua máquina

```bash
npm install
npm run dev
```

Abre em http://localhost:5173.

**Acesso de teste:** `huggomagelo@gmail.com` · senha `admin1234`

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento, recarrega ao salvar |
| `npm run build` | Gera a pasta `dist/` para publicar |
| `npm run preview` | Serve o `dist/` local, igual ao que o Netlify vai servir |
| `npm run lint` | Verifica o código |

---

## Publicar no Netlify

**Opção A — arrastar a pasta (mais rápido)**

1. `npm run build`
2. Entre em [app.netlify.com/drop](https://app.netlify.com/drop)
3. Arraste a pasta **`dist`** (não a pasta do projeto)

**Opção B — conectar ao GitHub (recomendado a médio prazo)**

Suba o projeto num repositório e conecte no Netlify. O `netlify.toml` já aponta o build
(`npm run build`) e a pasta publicada (`dist`).

**Os dois jeitos funcionam igual** porque as regras do Netlify moram em `public/_redirects`
e `public/_headers`, que o Vite copia para dentro do `dist/`. Ou seja, a pasta publicada é
autossuficiente — não existe o risco de arrastar só ela e as rotas quebrarem.

| Arquivo | Para que serve |
|---|---|
| `public/_redirects` | Faz `/leads`, `/follow-ups` etc. funcionarem ao abrir direto ou recarregar |
| `public/_headers` | Cabeçalhos de segurança, cache dos assets e o tipo certo do manifesto PWA |

---

## O que tem em cada tela

| Tela | Para que serve |
|---|---|
| **Hoje** | Indicadores do dia, quem está esperando resposta, quem chegou hoje, follow-ups vencidos e o funil |
| **Follow-ups** | A fila de aprovação: agrupada por marco (2, 3, 5, 7, 15, 30 dias), com o rascunho pronto para editar e enviar |
| **Leads** | Busca e filtros por fila, status e etiqueta |
| **Conversa** | Histórico, envio, etiquetas, etapa do funil, controle da cadência e anotação interna |
| **Conexão** | Onde entra o QR Code (hoje é demonstração) |
| **Usuários** | Só admin: liberar cadastros pendentes, definir papel, bloquear, trocar senha |
| **Configurações** | Marcos da cadência, horário de atendimento, SLA, travas de disparo e histórico de ações |

---

## As regras que o painel segue

Toda a lógica de "quem precisa de atenção" está em **`src/lib/followup.js`**, em funções
puras. É o mesmo arquivo que vai rodar no backend na Fase 4 — a regra não é duplicada.

**Duas filas separadas, nunca misturadas:**

- **Responder agora** — a última mensagem é do lead. É SLA, não cadência. Um lead novo
  vira urgente em 1h; uma conversa em andamento, em 4h (configurável).
- **Follow-up** — a última mensagem é sua e o lead sumiu. Aí sim entram os marcos de
  2, 3, 5, 7, 15 e 30 dias.

**Regra de ouro:** o lead respondeu → a cadência para sozinha e zera. Ninguém recebe
"ainda tem interesse?" depois de ter acabado de responder.

**A cadência nunca roda quando:** o lead pediu para não receber (opt-out), está marcado
como cliente ou perdido, foi pausado manualmente ou foi adiado.

**Marco devido** é o maior marco já vencido que ainda não foi disparado. Se você ficou
uma semana sem abrir o painel, o lead não recebe quatro mensagens de uma vez — recebe a
mais recente cabível.

### Perfis de objeção

O rascunho do follow-up muda conforme a objeção do lead, não conforme o nome. Os perfis
ficam em `src/lib/templates.js` e podem ser trocados na tela da conversa:

| Perfil | Quem é |
|---|---|
| **Começando do zero** | Quer entrar no digital mas não sabe por onde |
| **Já tentou antes** | Dropshipping, marca própria, afiliado — e não deu certo |
| **Sem tempo** | CLT ou autônomo, poucas horas livres por dia |
| **Travado no preço** | Tem interesse, mas o valor pesa no momento |
| **Desconfiado** | Medo de golpe, acha que pode ser pirâmide |

### Regras de copy que os rascunhos respeitam

Tiradas do briefing e válidas também para o follow-up, não só para os criativos:

- ✗ nada de "fique rico rápido", "ganhe dinheiro fácil" ou "sem fazer nada"
- ✗ não prometer valor exato de ganho nem prazo ("em 7 dias você vai…")
- ✗ nada que soe a esquema ou pirâmide, nem urgência falsa
- ✓ tom de revelação e educação: mostrar, não convencer
- ✓ "não é mágica, é método" — resultado vem com estudo e execução

A única cifra usada é a comissão de R$300 a R$987 por venda, que é fato do produto.

---

## Estrutura

```
supabase/
  schema.sql       tabelas, gatilhos e RLS (cole no SQL Editor)
  LEIA-ME.md       passo a passo para ligar o banco
src/
  services/
    supabase.js    cliente e detecção de modo
    repositorio.js camada de dados (banco <-> formato da interface)
    whatsapp.js    adaptador de conexão  -> vira Baileys na Fase 3
  state/
    auth.jsx       escolhe o modo de login
    authLocal.jsx  login de demonstração
    authSupabase.jsx  login real
    store.jsx      leads, config e ações (grava nos dois modos)
  lib/
    followup.js      motor de cadência e urgência (funções puras)
    templates.js     geração do rascunho por marco e perfil de objeção
    format.js        datas, telefone, iniciais, cores
    seloExterno.js   mede o selo da hospedagem e sobe a navegação
  data/mock.js       leads de exemplo (só no modo demonstração)
  components/        layout e peças visuais
  pages/             as sete telas
  index.css          design system inteiro (cores em tokens no topo)
```

### Trocar as cores

Tudo está no bloco `:root` no topo de `src/index.css`:

```css
--bg: #05070c;        /* preto de fundo */
--surface: #0d1420;   /* cartões */
--blue: #2f6bff;      /* azul principal */
--blue-400: #5b8cff;  /* azul claro, hover e destaque */
```

---

## O que é real e o que é simulado

| | Hoje |
|---|---|
| Interface, filas, cadência, funil, filtros | ✅ Real, funcionando |
| Login e papéis de usuário | ⚠️ Real no fluxo, mas roda no navegador — **não é segurança de verdade** |
| Leads e conversas | ⚠️ Fictícios, gerados a cada carregamento |
| Conexão com o WhatsApp | ⚠️ Demonstração. O QR é desenhado localmente e não conecta nada |
| Envio de mensagem | ⚠️ Registrado só no painel, nada sai para o WhatsApp |

As alterações que você fizer (status, etiquetas, envios, configurações) ficam salvas no
navegador. Em **Configurações → Restaurar exemplo** tudo volta ao estado inicial.

### A etiqueta do WhatsApp manda

A retriagem é feita dentro do próprio WhatsApp. O painel só traz conversas que carregam uma
das etiquetas configuradas em **Configurações → Quem é lead** (`config.etiquetasDeLead`);
fornecedor, spam e conversa pessoal ficam de fora sem ninguém arquivar nada. A tela mostra
quantas conversas estão sendo ignoradas, para o filtro nunca esconder coisa em silêncio.

Cuidado ao mexer: *"Sem perfil"* é para quem **nunca foi lead**. Quem foi lead e não fechou
continua com etiqueta de lead e status `perdido` — senão some do painel e você perde o
registro das perdas.

### Áudio é conteúdo de primeira classe

Boa parte da triagem chega por áudio, então a mensagem tem `tipo` (`texto` | `audio`),
`duracaoSeg` e `transcricao`. Na lista e na conversa, o que o painel mostra é a
**transcrição** — é dela que sai a informação do lead. Hoje ela vem pronta nos dados de
exemplo; na Fase 4 passa a ser gerada a partir do arquivo de áudio.

### Um lead por dono, um número por pessoa

Cada lead tem `responsavel` (o id do usuário) e cada usuário tem `numero`. As filas são
montadas só com os leads do escopo escolhido, então um operador nunca vê a fila do outro.
O número fica em **Usuários → Número** e é o que a pessoa vincula por QR Code.

Se um lead chegar sem nenhuma mensagem (falha de sincronia do bridge, por exemplo), ele sai
de todas as filas com o aviso "Conversa ainda não sincronizada" em vez de derrubar o painel.

### Trocar os dados de exemplo

`VERSAO_DADOS`, em `src/state/store.jsx`, é a marca de versão do conjunto de exemplo.
Sempre que mudar o conteúdo ou o formato dos leads, **suba esse número**: quem já tinha o
painel aberto recebe o conjunto novo em vez de continuar vendo o antigo guardado no
navegador. Foi assim que a troca do nicho chegou em todo mundo.

### O selo da hospedagem

O Netlify injeta um selo "Powered by Netlify" fixo no rodapé (197×64px, `z-index` máximo).
No celular ele cobria mais da metade da navegação inferior. Em vez de escondê-lo — o que
pode ferir os termos do plano —, `src/lib/seloExterno.js` mede o selo e sobe a navegação
exatamente o necessário, via a variável CSS `--selo-externo`. Se o selo deixar de existir
(plano pago, outra hospedagem), a barra volta a encostar no rodapé sozinha.

---

## Próximas fases

**Fase 2 — Supabase.** ✅ Pronta. Schema, RLS, login real e aprovação de usuários. Falta
só criar o projeto e configurar as variáveis: [`supabase/LEIA-ME.md`](supabase/LEIA-ME.md).

**Fase 3 — Bridge do WhatsApp.** Processo Node rodando 24/7 **fora do Netlify** (o
Netlify não sustenta sessão de WhatsApp: funções serverless morrem em segundos). Ele gera
o QR, recebe e envia mensagens. Só muda o `src/services/whatsapp.js` — nenhuma tela é
reescrita. A conexão será por **Baileys**, com a camada de envio trocável caso um dia
precisemos migrar para a API oficial da Meta.

**Fase 4 — Rascunho por IA e disparo agendado.** O `templates.js` passa a chamar a API do
Claude com as últimas mensagens da conversa, gerando um rascunho de verdade personalizado.
A fila de aprovação continua igual: nada sai sem você clicar.

---

## Avisos importantes

**Use um número dedicado.** A conexão por QR Code não é oficial do WhatsApp e existe risco
real de bloqueio do número. Nunca use o seu pessoal.

**LGPD.** O painel já tem opt-out que bloqueia toda a cadência, anotação interna separada
do que vai para o lead, e histórico de ações. Na Fase 2 entra o controle de acesso por
usuário no banco.

**As travas existem por um motivo.** Teto diário, intervalo entre disparos e horário
comercial protegem o número e as pessoas. Afrouxá-las aumenta o risco de bloqueio.
