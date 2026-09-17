// Formatação de datas, telefones e nomes. Sem dependências externas.

const MS_MIN = 60 * 1000;
const MS_HORA = 60 * MS_MIN;
const MS_DIA = 24 * MS_HORA;

export function paraData(v) {
  return v instanceof Date ? v : new Date(v);
}

/** Diferença em minutos inteiros entre agora e uma data passada. */
export function minutosDesde(v, agora = new Date()) {
  return Math.floor((agora - paraData(v)) / MS_MIN);
}

export function horasDesde(v, agora = new Date()) {
  return (agora - paraData(v)) / MS_HORA;
}

/**
 * Dias corridos entre duas datas, contados por virada de dia — não por 24h.
 * Mensagem de ontem às 23h conta como 1 dia, não como 0.
 */
export function diasDesde(v, agora = new Date()) {
  const a = paraData(v);
  const ini = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((fim - ini) / MS_DIA);
}

export function ehHoje(v, agora = new Date()) {
  return diasDesde(v, agora) === 0;
}

/** "agora", "12 min", "3h", "ontem", "5 dias", "12/03" */
export function tempoRelativo(v, agora = new Date()) {
  const min = minutosDesde(v, agora);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24 && ehHoje(v, agora)) return `${horas}h`;
  const dias = diasDesde(v, agora);
  if (dias === 1) return "ontem";
  if (dias < 7) return `${dias} dias`;
  return paraData(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Espera em formato longo, para a fila de urgência: "aguarda há 3h20" */
export function esperaLonga(v, agora = new Date()) {
  const min = minutosDesde(v, agora);
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  if (horas < 24) return resto ? `${horas}h${String(resto).padStart(2, "0")}` : `${horas}h`;
  const dias = diasDesde(v, agora);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

export function hora(v) {
  return paraData(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function dataLonga(v) {
  return paraData(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Cabeçalho de dia dentro da conversa. */
export function diaDaConversa(v, agora = new Date()) {
  const dias = diasDesde(v, agora);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 7) return paraData(v).toLocaleDateString("pt-BR", { weekday: "long" });
  return paraData(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/** 5511987654321 -> (11) 98765-4321 */
export function telefoneBonito(tel) {
  const d = String(tel).replace(/\D/g, "");
  const semPais = d.startsWith("55") ? d.slice(2) : d;
  if (semPais.length === 11) return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 7)}-${semPais.slice(7)}`;
  if (semPais.length === 10) return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 6)}-${semPais.slice(6)}`;
  return tel;
}

export function primeiroNome(nome) {
  return String(nome).trim().split(/\s+/)[0];
}

export function iniciais(nome) {
  // ignora pedaços sem letra, como "(secretária)" ou "-"
  const partes = String(nome)
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  if (!partes.length) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Cor estável por nome, dentro da paleta azul do painel. */
const CORES = [
  "linear-gradient(145deg,#2f6bff,#1a3fae)",
  "linear-gradient(145deg,#5b8cff,#2f6bff)",
  "linear-gradient(145deg,#1e4fd8,#0f2a73)",
  "linear-gradient(145deg,#3d7ce0,#1c3f8f)",
  "linear-gradient(145deg,#6a8fd8,#2b4f9e)",
  "linear-gradient(145deg,#2455c9,#13307a)",
];

export function corDoNome(nome) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
}

export function plural(n, singular, plural_) {
  return `${n} ${n === 1 ? singular : plural_}`;
}
