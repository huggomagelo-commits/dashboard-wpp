// ============================================================================
// Geração do rascunho de follow-up — Goffex School.
//
// Produto: mentoria de R$ 1.297 (pagamento único) que ensina afiliação de
// produtos físicos (nutracêuticos) com tráfego pago, IA e WhatsApp.
// Lead chega do anúncio direto na conversa.
//
// REGRAS DE COPY (do briefing — valem também para o follow-up):
//   ✗ nada de "fique rico rápido" / "ganhe dinheiro fácil"
//   ✗ não prometer valor exato de ganho nem prazo ("em 7 dias você vai...")
//   ✗ não dizer "sem fazer nada" — o método exige estudo e execução
//   ✗ nada que soe a esquema/pirâmide, nem urgência falsa
//   ✓ tom de revelação e educação: mostrar, não convencer
//   ✓ "não é mágica, é método" — resultado vem com aplicação
//
// Fase 1 (aqui): modelos por marco e por objeção, com variações estáveis por
// lead — duas pessoas no mesmo marco não recebem texto idêntico.
// Fase 4: esta função passa a chamar a API do Claude com as últimas mensagens
// da conversa. A assinatura continua a mesma, então nada na interface muda.
// ============================================================================

import { primeiroNome } from "./format.js";

/** Intenção de cada degrau da cadência — orienta o tom do texto. */
export const TOM_DO_MARCO = {
  2: { rotulo: "Lembrete leve", intencao: "Só relembrar, sem cobrar. A pessoa provavelmente se distraiu." },
  3: { rotulo: "Retomada", intencao: "Retomar de onde parou e facilitar a resposta com uma pergunta simples." },
  5: { rotulo: "Quebra de objeção", intencao: "Nomear o que costuma travar esse perfil e tirar o peso da decisão." },
  7: { rotulo: "Prova e método", intencao: "Trazer prova concreta — aluno real, como o método funciona. Sem promessa de valor." },
  15: { rotulo: "Reativação", intencao: "Reabrir com algo novo, sem repetir o que já foi dito." },
  30: { rotulo: "Última tentativa", intencao: "Encerrar com elegância e deixar a porta aberta." },
};

/**
 * Perfis por objeção — é o que mais muda a conversa nesse nicho.
 * O perfil é definido na qualificação e pode ser trocado na tela do lead.
 */
export const PERFIS = {
  iniciante: { rotulo: "Começando do zero", descricao: "Quer entrar no digital mas não sabe por onde." },
  ja_tentou: { rotulo: "Já tentou antes", descricao: "Dropshipping, marca própria, afiliado — e não deu certo." },
  sem_tempo: { rotulo: "Sem tempo", descricao: "CLT ou autônomo, poucas horas livres por dia." },
  preco: { rotulo: "Travado no preço", descricao: "Tem interesse, mas o valor pesa no momento." },
  desconfiado: { rotulo: "Desconfiado", descricao: "Medo de golpe, acha que pode ser pirâmide." },
};

const MODELOS = {
  2: [
    "Oi, {nome}! Passando só pra lembrar que ficou em aberto aqui a sua dúvida sobre {assunto}. Quando puder responder, eu continuo de onde a gente parou.",
    "Oi, {nome}, tudo bem? Vi que nossa conversa parou. Qualquer dúvida que tenha ficado sobre {assunto}, é só me chamar que eu explico.",
  ],
  3: [
    "Oi, {nome}! Voltando aqui sobre {assunto}. Me confirma {pendencia} que eu te mostro o próximo passo.",
    "Oi, {nome}! A gente parou na conversa sobre {assunto}. Ainda faz sentido pra você? Se fizer, me diz {pendencia} que eu retomo daqui.",
  ],
  5: [
    "Oi, {nome}. {objecao} Se preferir, te explico por áudio — costuma ser mais rápido do que ler tudo por escrito.",
    "Oi, {nome}, tudo bem? {objecao} Me diz o que te deixou em dúvida que eu respondo direto, sem enrolação.",
  ],
  7: [
    "Oi, {nome}. {prova} Não é mágica, é método — funciona pra quem aplica. Quer que eu te mostre como seria no seu caso?",
    "Oi, {nome}, tudo bem? {prova} Se quiser ver por dentro antes de decidir qualquer coisa, é só me falar.",
  ],
  15: [
    "Oi, {nome}! Faz um tempo que a gente não conversa. {novidade} Se ainda tiver interesse, me dá um sinal por aqui.",
    "{nome}, tudo bem? Passando pra saber se o seu momento mudou. {novidade}",
  ],
  30: [
    "Oi, {nome}. Vou encerrar seu atendimento por aqui pra não te incomodar mais. Mas fica o combinado: se um dia quiser retomar, é só chamar neste mesmo número que eu te atendo.",
    "{nome}, como não consegui falar com você, vou fechar esse atendimento. Guarda meu contato — se mudar de ideia, estou à disposição.",
  ],
};

const POR_PERFIL = {
  iniciante: {
    assunto: "como a Goffex funciona na prática",
    pendencia: "quanto tempo por dia você teria pra se dedicar",
    objecao: "Começar do zero assusta mesmo — a parte de anúncio é o que mais trava quem chega agora.",
    prova: "Boa parte dos alunos entrou sem saber nada de digital e aprendeu a estrutura do zero.",
    novidade: "Tem gente começando do zero toda semana, com o funil já pronto pra configurar.",
  },
  ja_tentou: {
    assunto: "o modelo de afiliação de produto físico",
    pendencia: "o que você já tentou antes e onde travou",
    objecao: "Quem já tentou dropshipping ou marca própria costuma travar no mesmo ponto: precisa cuidar de produto, estoque e suporte. Aqui o modelo é outro — você só promove.",
    prova: "O Ellon também perdeu dinheiro com dropshipping e marca própria antes de achar esse modelo. A escola nasceu justamente do que funcionou depois.",
    novidade: "Se você já tentou e não deu certo, na maioria das vezes o problema foi o modelo, não você.",
  },
  sem_tempo: {
    assunto: "como encaixar isso na sua rotina",
    pendencia: "quantas horas por dia dá pra separar",
    objecao: "Dá pra tocar com 1 a 2 horas por dia: a criação dos anúncios sai com IA e a conversa no WhatsApp roda com automação.",
    prova: "Tem aluno tocando isso depois do expediente, no fim da noite — exige constância, não o dia inteiro.",
    novidade: "A parte que mais consumia tempo era criar os criativos, e hoje a IA faz isso em minutos.",
  },
  preco: {
    assunto: "o que está incluso e as condições",
    pendencia: "se o valor é o único ponto que está travando",
    objecao: "Se o que está pesando é o valor, me fala abertamente. Prefiro te explicar direito o que está incluso a você entrar com dúvida.",
    prova: "A comissão do aluno fica entre R$300 e R$987 por venda de nutracêutico — é isso que faz a conta fechar com o tempo, com método e execução.",
    novidade: "Se o seu momento financeiro mudou, me avisa que eu te passo as condições atuais.",
  },
  desconfiado: {
    assunto: "como o método funciona por dentro",
    pendencia: "o que exatamente te deixou com o pé atrás",
    objecao: "Desconfiar é sinal de juízo — tem muita coisa ruim circulando nesse mercado. Por isso prefiro te mostrar a estrutura antes de falar em qualquer decisão.",
    prova: "Não é esquema nem indicação de gente: você vende produto físico de terceiros como afiliado e ganha comissão por venda. Posso te mostrar por dentro.",
    novidade: "Posso te mostrar a área de alunos por dentro, sem compromisso, pra você tirar sua própria conclusão.",
  },
  padrao: {
    assunto: "o que a gente conversou",
    pendencia: "se ainda faz sentido pra você",
    objecao: "Se ficou alguma dúvida travando a decisão, me diz qual é.",
    prova: "É afiliação de produto físico: sem estoque, sem produto próprio e sem precisar aparecer. Não é mágica, é método.",
    novidade: "Tivemos novidades que podem se aplicar ao seu caso.",
  },
};

function escolher(lista, semente, variante = 0) {
  let h = 0;
  const s = String(semente);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return lista[(h + variante) % lista.length];
}

/**
 * Monta o rascunho para um lead em um marco da cadência.
 * `variante` alterna entre os textos disponíveis quando você pede outro.
 * Retorna sempre um rascunho — ele nunca é enviado sozinho, sempre passa
 * pela sua aprovação na fila de follow-up.
 */
export function gerarRascunho(lead, marco, variante = 0) {
  const modelos = MODELOS[marco] || MODELOS[3];
  const vars = POR_PERFIL[lead.perfil] || POR_PERFIL.padrao;
  const texto = escolher(modelos, lead.id + ":" + marco, variante);

  return texto
    .replace(/\{nome\}/g, primeiroNome(lead.nome))
    .replace(/\{assunto\}/g, vars.assunto)
    .replace(/\{pendencia\}/g, vars.pendencia)
    .replace(/\{objecao\}/g, vars.objecao)
    .replace(/\{prova\}/g, vars.prova)
    .replace(/\{novidade\}/g, vars.novidade);
}

/** Sugestão rápida para quem está na fila de "responder agora". */
export function sugestaoDeResposta(lead) {
  const nome = primeiroNome(lead.nome);
  if (lead.status === "novo") {
    return `Opa, ${nome}! Tudo bem? Recebi sua mensagem. Pra eu te explicar do jeito certo, me conta duas coisas: você já tentou vender alguma coisa pela internet antes, e quanto tempo por dia você conseguiria separar?`;
  }
  return `Oi, ${nome}! Desculpa a demora. Já estou vendo aqui e te respondo em seguida.`;
}
