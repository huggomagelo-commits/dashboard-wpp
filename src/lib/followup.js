// ============================================================================
// Motor de follow-up — funções puras, sem React e sem acesso a rede.
// Esta é a única fonte de verdade sobre "quem precisa de atenção e por quê".
// Na Fase 3/4 o mesmo arquivo roda no backend para agendar os disparos.
// ============================================================================

import { diasDesde, ehHoje, horasDesde, minutosDesde } from "./format.js";

/** Marcos da cadência, em dias sem resposta. */
export const MARCOS = [2, 3, 5, 7, 15, 30];

export const STATUS = {
  novo: { rotulo: "Novo", cor: "blue", ordem: 1 },
  em_conversa: { rotulo: "Em conversa", cor: "blue", ordem: 2 },
  qualificado: { rotulo: "Qualificado", cor: "ok", ordem: 3 },
  proposta: { rotulo: "Oferta enviada", cor: "warn", ordem: 4 },
  cliente: { rotulo: "Aluno", cor: "ok", ordem: 5 },
  perdido: { rotulo: "Perdido", cor: "danger", ordem: 6 },
};

/** Status em que a cadência nunca roda. */
const STATUS_ENCERRADOS = ["cliente", "perdido"];

export const CONFIG_PADRAO = {
  marcos: MARCOS,
  // Só entram no painel as conversas que receberam uma destas etiquetas na
  // retriagem feita dentro do WhatsApp. O resto (fornecedor, spam, pessoal)
  // fica de fora sem você precisar arquivar nada.
  etiquetasDeLead: ["Lead", "Lead quente", "Lead frio", "Aluno"],
  // SLA de resposta, em horas. Lead vindo de anúncio esfria rápido:
  // quem clicou agora está com o celular na mão.
  slaPrimeiraResposta: 0.25, // 15 min para responder quem mandou mensagem
  slaConversa: 4, // lead já em conversa
  // Janela de atendimento. Venda por WhatsApp acontece muito à noite e no
  // sábado — ajuste em Configurações se a sua rotina for outra.
  horaInicio: 9,
  horaFim: 21,
  diasUteis: [1, 2, 3, 4, 5, 6], // 0 = domingo
  // travas de disparo
  tetoDiario: 30,
  intervaloMinSegundos: 45,
  intervaloMaxSegundos: 180,
  exigirAprovacao: true,
};

export const URGENCIA = {
  critico: { rotulo: "Crítico", cor: "danger", peso: 4 },
  alto: { rotulo: "Urgente", cor: "warn", peso: 3 },
  medio: { rotulo: "Atenção", cor: "blue", peso: 2 },
  baixo: { rotulo: "Tranquilo", cor: "ok", peso: 1 },
};

// ---------------------------------------------------------------------------
// Janela de atendimento
// ---------------------------------------------------------------------------

export function dentroDaJanela(config = CONFIG_PADRAO, agora = new Date()) {
  const dia = agora.getDay();
  const h = agora.getHours();
  return config.diasUteis.includes(dia) && h >= config.horaInicio && h < config.horaFim;
}

/** Próximo instante em que a janela de atendimento abre. */
export function proximaJanela(config = CONFIG_PADRAO, agora = new Date()) {
  const d = new Date(agora);
  for (let i = 0; i < 14; i++) {
    const ehDiaUtil = config.diasUteis.includes(d.getDay());
    if (ehDiaUtil) {
      if (d.getTime() === agora.getTime() && agora.getHours() < config.horaInicio) {
        d.setHours(config.horaInicio, 0, 0, 0);
        return d;
      }
      if (i > 0) {
        d.setHours(config.horaInicio, 0, 0, 0);
        return d;
      }
    }
    d.setDate(d.getDate() + 1);
    d.setHours(config.horaInicio, 0, 0, 0);
  }
  return d;
}

// ---------------------------------------------------------------------------
// Análise de um lead
// ---------------------------------------------------------------------------

/**
 * Por que a cadência automática não pode rodar para este lead.
 * Retorna null quando não há bloqueio.
 */
export function motivoDeBloqueio(lead) {
  if (lead.optOut) return "Pediu para não receber mensagens";
  if (STATUS_ENCERRADOS.includes(lead.status)) return `Marcado como ${STATUS[lead.status].rotulo.toLowerCase()}`;
  if (lead.cadenciaPausada) return "Cadência pausada manualmente";
  if (lead.adiadoAte && new Date(lead.adiadoAte) > new Date()) return "Adiado";
  return null;
}

/**
 * O retrato completo de um lead em um instante. Tudo que a interface mostra
 * sobre urgência e cadência sai daqui — nenhuma tela recalcula por conta.
 */
export function analisar(lead, config = CONFIG_PADRAO, agora = new Date()) {
  const ultima = lead.ultimaMensagem;
  const bloqueio = motivoDeBloqueio(lead);
  // Lead que veio do formulário e ainda não tem nenhuma conversa no WhatsApp.
  const semConversa = !ultima || !lead.mensagens?.length;
  const aguardandoResposta = !semConversa && ultima.de === "lead";
  const nuncaRespondido = !lead.mensagens?.some((m) => m.de === "eu");
  const chegouHoje = ehHoje(lead.criadoEm, agora);

  const base = {
    id: lead.id,
    bloqueio,
    chegouHoje,
    semConversa,
    aguardandoResposta,
    nuncaRespondido,
    horasEsperando: 0,
    minutosEsperando: 0,
    diasSemResposta: 0,
    fila: "ok",
    urgencia: "baixo",
    marcoDevido: null,
    marcosEnviados: (lead.followups || []).map((f) => f.dia),
    proximoMarco: null,
    diasAteProximo: null,
    cadenciaEsgotada: false,
  };

  // Todo lead deste painel vem do WhatsApp, então sempre tem conversa. Se
  // um registro chegar sem mensagem (falha de sincronia do bridge, por
  // exemplo), ele sai de todas as filas em vez de derrubar o painel.
  if (semConversa) {
    return { ...base, fila: "bloqueado", bloqueio: "Conversa ainda não sincronizada" };
  }

  // --- Fila 1: o lead falou e está esperando resposta humana ---------------
  if (aguardandoResposta) {
    const horas = horasDesde(ultima.em, agora);
    const sla = nuncaRespondido ? config.slaPrimeiraResposta : config.slaConversa;
    let urgencia = "medio";
    if (horas >= sla * 3) urgencia = "critico";
    else if (horas >= sla) urgencia = "alto";
    else if (nuncaRespondido) urgencia = "alto";

    return {
      ...base,
      fila: "responder",
      urgencia,
      horasEsperando: horas,
      minutosEsperando: minutosDesde(ultima.em, agora),
    };
  }

  // --- Fila 2: falamos por último e o lead sumiu --------------------------
  const dias = diasDesde(ultima.em, agora);
  const enviados = base.marcosEnviados;
  const pendentes = config.marcos.filter((m) => !enviados.includes(m));

  // o marco devido é o maior que já venceu e ainda não foi disparado
  const vencidos = pendentes.filter((m) => dias >= m);
  const marcoDevido = vencidos.length ? Math.max(...vencidos) : null;
  const proximoMarco = pendentes.find((m) => dias < m) ?? null;

  const cadenciaEsgotada = pendentes.length === 0 || (marcoDevido === null && proximoMarco === null);

  let fila = "ok";
  let urgencia = "baixo";

  if (bloqueio) {
    fila = "bloqueado";
  } else if (marcoDevido !== null) {
    fila = "followup";
    // quanto mais tempo o marco está vencido, mais urgente
    const atraso = dias - marcoDevido;
    urgencia = atraso >= 2 ? "alto" : "medio";
  } else if (cadenciaEsgotada && dias > Math.max(...config.marcos)) {
    fila = "esgotado";
  } else {
    fila = "agendado";
  }

  return {
    ...base,
    fila,
    urgencia,
    diasSemResposta: dias,
    marcoDevido,
    proximoMarco,
    diasAteProximo: proximoMarco !== null ? proximoMarco - dias : null,
    cadenciaEsgotada,
  };
}

// ---------------------------------------------------------------------------
// Agrupamento das filas de trabalho
// ---------------------------------------------------------------------------

/**
 * Monta as listas que o painel usa. Cada lead entra em uma fila só,
 * para você nunca ver a mesma pessoa em dois lugares pedindo coisas diferentes.
 */
export function montarFilas(leads, config = CONFIG_PADRAO, agora = new Date()) {
  const analises = new Map();
  const responder = [];
  const novosHoje = [];
  const followups = [];
  const agendados = [];
  const esgotados = [];
  const bloqueados = [];

  for (const lead of leads) {
    const a = analisar(lead, config, agora);
    analises.set(lead.id, a);
    const item = { lead, analise: a };

    if (a.fila === "responder") {
      responder.push(item);
      if (a.chegouHoje && a.nuncaRespondido) novosHoje.push(item);
    } else if (a.fila === "followup") followups.push(item);
    else if (a.fila === "agendado") agendados.push(item);
    else if (a.fila === "esgotado") esgotados.push(item);
    else if (a.fila === "bloqueado") bloqueados.push(item);
  }

  // quem espera há mais tempo aparece primeiro
  responder.sort((x, y) => {
    const peso = URGENCIA[y.analise.urgencia].peso - URGENCIA[x.analise.urgencia].peso;
    return peso !== 0 ? peso : y.analise.minutosEsperando - x.analise.minutosEsperando;
  });
  novosHoje.sort((x, y) => y.analise.minutosEsperando - x.analise.minutosEsperando);
  // marco mais alto primeiro: quem está há 30 dias sumido é a última chance
  followups.sort((x, y) => y.analise.marcoDevido - x.analise.marcoDevido);
  agendados.sort((x, y) => x.analise.diasAteProximo - y.analise.diasAteProximo);

  return { analises, responder, novosHoje, followups, agendados, esgotados, bloqueados };
}

/** Agrupa a fila de follow-up por marco (2, 3, 5, 7, 15, 30). */
export function agruparPorMarco(followups, config = CONFIG_PADRAO) {
  return config.marcos
    .map((dia) => ({ dia, itens: followups.filter((f) => f.analise.marcoDevido === dia) }))
    .filter((g) => g.itens.length > 0);
}

/** Contagem por etapa do funil, na ordem certa. */
export function contarFunil(leads) {
  const chaves = Object.keys(STATUS).sort((a, b) => STATUS[a].ordem - STATUS[b].ordem);
  const total = leads.length || 1;
  return chaves.map((chave) => {
    const n = leads.filter((l) => l.status === chave).length;
    return { chave, ...STATUS[chave], total: n, percentual: Math.round((n / total) * 100) };
  });
}

/**
 * A conversa foi etiquetada como lead na retriagem do WhatsApp?
 * Sem nenhuma etiqueta qualificadora configurada, tudo entra.
 */
export function ehLead(lead, config = CONFIG_PADRAO) {
  const exigidas = config.etiquetasDeLead;
  if (!exigidas?.length) return true;
  return (lead.etiquetas || []).some((e) => exigidas.includes(e));
}

/** Todas as etiquetas em uso, com contagem, mais usadas primeiro. */
export function etiquetasEmUso(leads) {
  const mapa = new Map();
  for (const l of leads) for (const e of l.etiquetas || []) mapa.set(e, (mapa.get(e) || 0) + 1);
  return [...mapa.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
}
