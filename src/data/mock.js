// ============================================================================
// Dados de exemplo da Fase 1 — Goffex School.
//
// Leads chegam do anúncio (Meta Ads) direto no WhatsApp, pedindo informação
// sobre a mentoria de afiliação de nutracêuticos (R$ 1.297, pagamento único).
//
// Tudo é gerado a partir do horário atual, então as filas ficam sempre
// coerentes — não importa o dia em que você abrir o painel.
//
// Na Fase 2 este arquivo é substituído por consultas ao Supabase. O formato
// dos objetos é o mesmo, de propósito.
// ============================================================================

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

const atras = (ms) => new Date(Date.now() - ms).toISOString();

// Mensagem que o anúncio já deixa preenchida quando a pessoa clica.
const DO_ANUNCIO = "Olá! Vi o anúncio e quero saber mais sobre como vender pela internet.";

// cenário: como a conversa termina, que é o que define a fila do lead
//   esperando:N min  -> o lead falou por último, há N minutos
//   sumido:N dias    -> eu falei por último, há N dias, sem resposta
//
// mensagem: ["de", "texto"] ou ["de", "transcrição", { audio: segundos }]
// Boa parte da triagem acontece por áudio, então o painel precisa dar conta
// dos dois formatos desde o começo.
const SEMENTE = [
  {
    nome: "Rafael Moreira Santos", tel: "5511987412365", perfil: "iniciante", origem: "anuncio",
    status: "novo", etiquetas: ["Veio do anúncio", "CLT"], esperando: 6,
    conversa: [["lead", DO_ANUNCIO]],
  },
  {
    nome: "Jaqueline Pires", tel: "5511991234567", perfil: "preco", origem: "anuncio",
    status: "novo", etiquetas: ["Veio do anúncio", "Preço"], esperando: 34,
    conversa: [
      ["lead", "Oi! Vi o anúncio. Quanto custa pra entrar?"],
    ],
  },
  {
    nome: "Diego Albuquerque", tel: "5521998877665", perfil: "desconfiado", origem: "anuncio",
    status: "em_conversa", etiquetas: ["Veio do anúncio", "Medo de golpe", "Quente"], esperando: 168,
    conversa: [
      ["lead", "isso aí é pirâmide? porque tá parecendo"],
      ["eu", "Boa pergunta, Diego — e é bom que você desconfie. Não é. Você entra como afiliado de um produto físico que já existe (nutracêutico) e ganha comissão quando vende. Não tem indicação de gente, não tem rede embaixo de você.", { audio: 38 }],
      ["lead", "e como eu vendo sem ter o produto na mão?"],
    ],
  },
  {
    nome: "Camila Rodrigues Alves", tel: "5531987654321", perfil: "sem_tempo", origem: "instagram",
    status: "qualificado", etiquetas: ["Instagram", "CLT", "Sem tempo", "Quente"], esperando: 392,
    conversa: [
      ["lead", "Oi, tudo bem? Então, eu vi o anúncio de vocês e fiquei interessada, mas eu trabalho de segunda a sexta das oito às seis, chego em casa cansada... eu queria saber se mesmo assim dá pra fazer, se sobra tempo.", { audio: 27 }],
      ["eu", "Dá sim, Camila. A maior parte do trabalho é configurar o anúncio e deixar a operação rodando. Com 1 a 2 horas por dia, no seu horário, dá pra tocar. Não é sem esforço, mas não precisa do dia inteiro."],
      ["lead", "Entendi. E quanto custa o curso?"],
    ],
  },
  {
    nome: "Fernanda Barbosa", tel: "5511976543210", perfil: "iniciante", origem: "indicacao",
    status: "proposta", etiquetas: ["Indicação", "Quente"], esperando: 1490,
    conversa: [
      ["lead", "Recebi seu contato pelo Marcelo. Ele falou que entrou na Goffex."],
      ["eu", "Opa, Fernanda! O Marcelo é aluno sim. Me conta: você já tentou alguma coisa na internet antes?"],
      ["lead", "Nada, seria minha primeira vez."],
      ["eu", "Perfeito, o método foi desenhado pra quem começa do zero. Te mandei acima tudo que está incluso e o valor. Qualquer dúvida me chama."],
      ["lead", "Recebi! Vou ler com calma e te falo."],
    ],
  },
  {
    nome: "Bruno Tavares", tel: "5541999112233", perfil: "iniciante", origem: "anuncio",
    status: "novo", etiquetas: ["Veio do anúncio"], esperando: 19,
    conversa: [
      ["lead", "oi, tudo bem?"],
      ["lead", "vi o anúncio agora, queria entender melhor como funciona"],
    ],
  },
  {
    nome: "Simone Okamoto", tel: "5511965432178", perfil: "ja_tentou", origem: "instagram",
    status: "em_conversa", etiquetas: ["Instagram", "Já tentou antes"], sumido: 2,
    conversa: [
      ["lead", "Olha, vou ser bem sincera com você: eu já tentei dropshipping em 2023, perdi uns dois mil reais em anúncio e não vendi quase nada. Então assim, por que que isso aqui seria diferente?", { audio: 22 }],
      ["eu", "Entendo a desconfiança, Simone. No dropshipping você cuida de produto, fornecedor, entrega e suporte — é aí que a maioria trava. Aqui você só promove: a operação entrega e atende o cliente final. O Ellon também perdeu dinheiro com dropship antes de achar esse modelo."],
    ],
  },
  {
    nome: "Lucas Pinheiro", tel: "5581988776655", perfil: "sem_tempo", origem: "anuncio",
    status: "em_conversa", etiquetas: ["Veio do anúncio", "CLT", "Sem tempo"], sumido: 3,
    conversa: [
      ["lead", "Boa noite, queria saber sobre o método"],
      ["eu", "Boa noite, Lucas! Claro. Me conta: hoje você trabalha em quê e quanto tempo por dia conseguiria separar?"],
      ["lead", "sou CLT, chego em casa 19h. umas 2 horas por dia talvez"],
      ["eu", "2 horas por dia dá pra tocar tranquilo. Te explico como seria a rotina na prática?"],
    ],
  },
  {
    nome: "Renata Duarte Campos", tel: "5511954321098", perfil: "preco", origem: "anuncio",
    status: "qualificado", etiquetas: ["Veio do anúncio", "Preço"], sumido: 3, followups: [2],
    conversa: [
      ["lead", "gostei mas tá fora do meu orçamento agora"],
      ["eu", "Agradeço a sinceridade, Renata. Me diz uma coisa: o valor é o único ponto travando, ou ficou alguma dúvida sobre o método também?"],
    ],
  },
  {
    nome: "Vanderson Alves", tel: "5511943210987", perfil: "iniciante", origem: "anuncio",
    status: "em_conversa", etiquetas: ["Veio do anúncio", "Desempregado"], sumido: 5, followups: [2, 3],
    conversa: [
      ["lead", "to desempregado faz 4 meses, isso funciona mesmo?"],
      ["eu", "Funciona com método e execução, Vanderson — não é dinheiro fácil e não quero te vender isso. O aluno aprende a anunciar, atrair o lead e conduzir a venda no WhatsApp. Posso te mostrar como a estrutura funciona?"],
    ],
  },
  {
    nome: "Tatiane Ribeiro", tel: "5551987651234", perfil: "desconfiado", origem: "instagram",
    status: "qualificado", etiquetas: ["Instagram", "Medo de golpe"], sumido: 5, followups: [2, 3],
    conversa: [
      ["lead", "como eu sei que não vou perder meu dinheiro?"],
      ["eu", "Pergunta justa. Posso te mostrar a área de alunos por dentro antes de qualquer decisão, pra você ver o que está comprando. Quer que eu mande?"],
    ],
  },
  {
    nome: "Priscila Gomes Farias", tel: "5511932109876", perfil: "iniciante", origem: "indicacao",
    status: "proposta", etiquetas: ["Indicação"], sumido: 7, followups: [2, 3, 5],
    conversa: [
      ["lead", "A Fernanda me falou de você"],
      ["eu", "Oi, Priscila! Pelo que você me contou, o seu caso encaixa bem. Segue tudo que está incluso e o valor. Fico à disposição pra qualquer dúvida."],
    ],
  },
  {
    nome: "Michele Andrade", tel: "5511921098765", perfil: "sem_tempo", origem: "anuncio",
    status: "em_conversa", etiquetas: ["Veio do anúncio", "Autônomo", "Sem tempo"], sumido: 7, followups: [2, 3, 5],
    conversa: [
      ["lead", "Oi! Então, eu tenho dois filhos pequenos, um de três e um de um ano, e sinceramente eu mal tenho tempo pra nada. Seria loucura eu tentar isso agora?", { audio: 19 }],
      ["eu", "Não seria, Michele — mas seria com constância, não com pressa. A criação dos anúncios sai com IA em minutos e a conversa roda com automação. Me diz qual janela do dia é mais tranquila pra você?"],
    ],
  },
  {
    nome: "Débora Nunes", tel: "5511910987654", perfil: "preco", origem: "instagram",
    status: "em_conversa", etiquetas: ["Instagram", "Preço"], sumido: 15, followups: [2, 3, 5, 7],
    conversa: [
      ["lead", "quanto eu preciso pra investir em anúncio além do curso?"],
      ["eu", "Boa pergunta, Débora. Dá pra começar com verba baixa por dia e ir ajustando conforme o resultado aparece. O importante é não queimar tudo de uma vez — a primeira fase é de teste. Quer que eu detalhe?"],
    ],
  },
  {
    nome: "Carolina Pacheco", tel: "5511909876543", perfil: "ja_tentou", origem: "anuncio",
    status: "qualificado", etiquetas: ["Veio do anúncio", "Já tentou antes"], sumido: 15, followups: [2, 3, 5, 7],
    conversa: [
      ["lead", "já fui afiliada de infoproduto e não vendi nada"],
      ["eu", "Conheço bem esse caminho, Carolina. Infoproduto tem muita concorrência e o público já está saturado. Produto físico de saúde tem demanda constante e o ticket permite comissão de R$300 a R$987 por venda. É outro jogo."],
    ],
  },
  {
    nome: "Anderson Vasques", tel: "5511898765432", perfil: "iniciante", origem: "anuncio",
    status: "em_conversa", etiquetas: ["Veio do anúncio", "Frio"], sumido: 30, followups: [2, 3, 5, 7, 15],
    conversa: [
      ["lead", "vi no instagram, queria saber mais"],
      ["eu", "Opa, Anderson! Posso te explicar tudo. Me conta: você já tentou alguma coisa pela internet antes, e quanto tempo por dia teria?"],
    ],
  },
  {
    nome: "Elaine Cristina Moura", tel: "5511887654321", perfil: "iniciante", origem: "instagram",
    status: "em_conversa", etiquetas: ["Instagram", "Frio"], sumido: 34, followups: [2, 3, 5, 7, 15, 30],
    conversa: [
      ["lead", "oi"],
      ["eu", "Oi, Elaine! Tudo bem? Como posso te ajudar?"],
    ],
  },
  {
    nome: "Marcelo Bastos", tel: "5511876543210", perfil: "sem_tempo", origem: "anuncio",
    status: "cliente", etiquetas: ["Veio do anúncio", "CLT"], sumido: 4,
    conversa: [
      ["lead", "fiz o pagamento! já consigo acessar?"],
      ["eu", "Recebi, Marcelo! Acesso liberado, dá uma olhada no e-mail. Qualquer dificuldade na configuração me chama que eu te ajudo."],
    ],
  },
  {
    nome: "Luciana Barros", tel: "5511865432109", perfil: "iniciante", origem: "indicacao",
    status: "cliente", etiquetas: ["Indicação"], sumido: 12,
    conversa: [
      ["lead", "consegui rodar meu primeiro anúncio ontem!! obrigada"],
      ["eu", "Boa, Luciana! Esse é o passo mais difícil. Vai acompanhando as métricas e me chama se travar em algo."],
    ],
  },
  {
    nome: "Rosângela Prado", tel: "5511854321098", perfil: "desconfiado", origem: "instagram",
    status: "perdido", etiquetas: ["Medo de golpe"], sumido: 21,
    conversa: [
      ["lead", "não confio nesse tipo de coisa, desculpa"],
      ["eu", "Sem problema nenhum, Rosângela. Obrigado pela sinceridade. Se um dia quiser tirar alguma dúvida, é só chamar."],
    ],
  },
  {
    nome: "Gustavo Menezes", tel: "5511843210987", perfil: "preco", origem: "anuncio",
    status: "em_conversa", etiquetas: ["Veio do anúncio"], sumido: 6, optOut: true,
    conversa: [
      ["eu", "Oi, Gustavo! Voltando aqui sobre o que a gente conversou."],
      ["lead", "para de me mandar mensagem por favor"],
      ["eu", "Sem problema, Gustavo. Já te removi da lista. Desculpa o incômodo."],
    ],
  },
  {
    nome: "Kelly Nascimento", tel: "5511832109876", perfil: "preco", origem: "anuncio",
    status: "qualificado", etiquetas: ["Veio do anúncio", "Vai pensar"], sumido: 4, cadenciaPausada: true,
    conversa: [
      ["lead", "vou conversar com meu marido e te falo domingo"],
      ["eu", "Combinado, Kelly! Fico no aguardo, sem pressa."],
    ],
  },
  {
    nome: "Wesley Ferraz", tel: "5511821098765", perfil: "iniciante", origem: "anuncio",
    status: "novo", etiquetas: ["Veio do anúncio"], esperando: 3,
    conversa: [["lead", DO_ANUNCIO]],
  },
  {
    nome: "Amanda Figueiredo", tel: "5511810987654", perfil: "ja_tentou", origem: "anuncio",
    status: "novo", etiquetas: ["Veio do anúncio", "Já tentou antes"], esperando: 88,
    conversa: [
      ["lead", "Bom dia! Já tentei ser afiliada uma vez e não deu certo. Isso aqui é diferente mesmo?"],
    ],
  },
  {
    nome: "Jéssica Almeida Prado", tel: "5511809876543", perfil: "sem_tempo", origem: "instagram",
    status: "em_conversa", etiquetas: ["Instagram", "Quente"], sumido: 1,
    conversa: [
      ["lead", "boa noite, consigo falar com você amanhã?"],
      ["eu", "Claro, Jéssica! Amanhã a partir das 9h estou por aqui. Te chamo neste mesmo número."],
    ],
  },
  {
    nome: "Natália Correia", tel: "5511798765432", perfil: "desconfiado", origem: "anuncio",
    status: "em_conversa", etiquetas: ["Veio do anúncio", "Quer ver por dentro"], sumido: 1,
    conversa: [
      ["lead", "preciso aparecer em vídeo? porque eu morro de vergonha"],
      ["eu", "Não precisa, Natália. Os criativos são feitos com IA — você não grava nada e não precisa aparecer. Quer que eu te mostre exemplos de anúncio feitos assim?"],
    ],
  },
];

/** Distribui os leads entre a equipe de exemplo — cada um no seu número. */
const DONOS = ["admin", "u-ana", "admin", "u-ana", "admin"];

/**
 * Etiqueta do WhatsApp aplicada na retriagem. É ela que diz ao painel que
 * aquela conversa é um lead — quem não tem etiqueta de lead nem aparece.
 */
// "Sem perfil" é para conversa que a triagem decidiu que NÃO é lead. Quem foi
// lead e não fechou continua etiquetado como lead — senão some do funil e você
// perde o registro das perdas.
const QUALIFICADOR = {
  novo: "Lead",
  em_conversa: "Lead",
  qualificado: "Lead quente",
  proposta: "Lead quente",
  cliente: "Aluno",
  perdido: "Lead frio",
};

/**
 * Conversas que existem no WhatsApp mas NÃO são lead. Servem para provar que
 * o filtro por etiqueta funciona: elas ficam de fora de todas as filas.
 */
const CONVERSAS_NAO_LEAD = [
  {
    nome: "Fornecedor Gráfica", tel: "5511970001111", perfil: "iniciante", origem: "anuncio",
    status: "em_conversa", etiquetas: [], semQualificador: true, esperando: 55,
    conversa: [["lead", "Bom dia! Segue o orçamento dos materiais que você pediu."]],
  },
  {
    nome: "Marcos (contador)", tel: "5511970002222", perfil: "iniciante", origem: "indicacao",
    status: "em_conversa", etiquetas: [], semQualificador: true, sumido: 2,
    conversa: [
      ["lead", "Me manda as notas do mês quando puder"],
      ["eu", "Mando hoje ainda, Marcos."],
    ],
  },
  {
    nome: "Divulgação Imóveis", tel: "5511970003333", perfil: "iniciante", origem: "anuncio",
    status: "em_conversa", etiquetas: [], semQualificador: true, esperando: 300,
    conversa: [["lead", "APARTAMENTO NOVO NA PLANTA, ENTRADA FACILITADA! Confira..."]],
  },
];

function montarLead(s, i) {
  const total = s.conversa.length;
  // a última mensagem ancora a linha do tempo; as anteriores ficam antes dela
  const fimMs = s.esperando != null ? s.esperando * MIN : (s.sumido ?? 1) * DIA + 3 * HORA;

  const mensagens = s.conversa.map(([de, texto, opcoes], idx) => {
    const passosAntes = total - 1 - idx;
    const deslocamento = fimMs + passosAntes * (idx === 0 ? 3 * HORA : 40 * MIN) + passosAntes * 12 * MIN;
    const ehAudio = !!opcoes?.audio;
    return {
      id: `m${i}-${idx}`,
      de,
      tipo: ehAudio ? "audio" : "texto",
      // em áudio, `texto` guarda a transcrição — é dela que sai a informação
      texto: ehAudio ? "" : texto,
      transcricao: ehAudio ? texto : null,
      duracaoSeg: ehAudio ? opcoes.audio : null,
      em: atras(deslocamento),
    };
  });

  const ultima = mensagens[mensagens.length - 1];
  const primeira = mensagens[0];
  const resumoUltima = ultima.tipo === "audio" ? ultima.transcricao : ultima.texto;

  const followups = (s.followups || []).map((dia) => ({
    dia,
    em: atras(Math.max(0, (s.sumido ?? 0) - dia) * DIA),
    por: "admin",
  }));

  return {
    id: `lead-${String(i + 1).padStart(3, "0")}`,
    nome: s.nome,
    telefone: s.tel,
    perfil: s.perfil,
    origem: s.origem,
    status: s.status,
    // a etiqueta qualificadora vem da retriagem feita no próprio WhatsApp
    etiquetas: s.semQualificador
      ? s.etiquetas || []
      : [QUALIFICADOR[s.status], ...(s.etiquetas || [])],
    criadoEm: primeira.em,

    mensagens,
    ultimaMensagem: { de: ultima.de, tipo: ultima.tipo, texto: resumoUltima, em: ultima.em },
    naoLidas: ultima.de === "lead" ? (s.conversa.filter(([de]) => de === "lead").length > 1 ? 2 : 1) : 0,
    followups,
    cadenciaPausada: !!s.cadenciaPausada,
    optOut: !!s.optOut,
    adiadoAte: null,
    responsavel: DONOS[i % DONOS.length],
    anotacao: "",
  };
}

export function leadsDeExemplo() {
  return [...SEMENTE, ...CONVERSAS_NAO_LEAD].map(montarLead);
}

/** Etiquetas do WhatsApp usadas na retriagem, na ordem em que fazem sentido. */
export const ETIQUETAS_WHATSAPP = [
  "Lead", "Lead quente", "Lead frio", "Aluno", "Sem perfil", "Não responder",
];

export const ETIQUETAS_SUGERIDAS = [
  ...ETIQUETAS_WHATSAPP,
  "Veio do anúncio", "Instagram", "Indicação",
  "CLT", "Autônomo", "Desempregado",
  "Sem tempo", "Já tentou antes", "Medo de golpe", "Preço",
  "Quer ver por dentro", "Pediu o link", "Vai pensar",
  "Quente", "Frio",
];
