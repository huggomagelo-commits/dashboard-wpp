// ============================================================================
// Camada de dados do painel.
//
// Traduz entre o formato do banco (snake_case, tabelas separadas) e o formato
// que a interface já usa desde a Fase 1 (camelCase, lead com mensagens dentro).
// Nenhuma tela conhece o Supabase — elas falam só com o store.
// ============================================================================

import { supabase } from "./supabase.js";

// ------------------------------------------------------------- conversões

function leadDoBanco(linha) {
  const mensagens = (linha.mensagens || [])
    .map((m) => ({
      id: m.id,
      de: m.de,
      tipo: m.tipo,
      texto: m.texto || "",
      transcricao: m.transcricao,
      duracaoSeg: m.duracao_seg,
      midiaUrl: m.midia_url,
      em: m.em,
    }))
    .sort((a, b) => new Date(a.em) - new Date(b.em));

  const ultima = mensagens[mensagens.length - 1] || null;

  return {
    id: linha.id,
    nome: linha.nome,
    telefone: linha.telefone,
    perfil: linha.perfil,
    origem: linha.origem,
    status: linha.status,
    etiquetas: linha.etiquetas || [],
    criadoEm: linha.criado_em,
    mensagens,
    ultimaMensagem: ultima
      ? {
          de: ultima.de,
          tipo: ultima.tipo,
          texto: ultima.tipo === "audio" ? ultima.transcricao || "Áudio" : ultima.texto,
          em: ultima.em,
        }
      : null,
    naoLidas: 0,
    followups: (linha.followups || []).map((f) => ({ dia: f.dia, em: f.em, por: f.por })),
    cadenciaPausada: linha.cadencia_pausada,
    optOut: linha.opt_out,
    adiadoAte: linha.adiado_ate,
    responsavel: linha.responsavel,
    anotacao: linha.anotacao || "",
  };
}

function perfilDoBanco(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    papel: linha.papel,
    situacao: linha.situacao,
    numero: linha.numero || "",
    criadoEm: linha.criado_em,
    ultimoAcesso: linha.ultimo_acesso,
  };
}

// ------------------------------------------------------------------- leads

/**
 * Traz os leads que a RLS permitir. Não existe filtro por responsável aqui de
 * propósito: quem decide o que cada um vê é o banco, não o JavaScript.
 */
export async function carregarLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select(`
      *,
      mensagens ( id, de, tipo, texto, transcricao, duracao_seg, midia_url, em ),
      followups ( dia, em, por )
    `)
    .order("atualizado_em", { ascending: false });

  if (error) throw error;
  return (data || []).map(leadDoBanco);
}

const CAMPOS_DO_LEAD = {
  status: "status",
  perfil: "perfil",
  etiquetas: "etiquetas",
  cadenciaPausada: "cadencia_pausada",
  optOut: "opt_out",
  adiadoAte: "adiado_ate",
  anotacao: "anotacao",
  responsavel: "responsavel",
};

export async function salvarLead(id, mudancas) {
  const payload = {};
  for (const [chave, valor] of Object.entries(mudancas)) {
    const coluna = CAMPOS_DO_LEAD[chave];
    if (coluna) payload[coluna] = valor;
  }
  if (!Object.keys(payload).length) return;

  const { error } = await supabase.from("leads").update(payload).eq("id", id);
  if (error) throw error;
}

// --------------------------------------------------------------- mensagens

export async function gravarMensagem(leadId, texto, { marco = null, autor = null } = {}) {
  const { data, error } = await supabase
    .from("mensagens")
    .insert({ lead_id: leadId, de: "eu", tipo: "texto", texto })
    .select()
    .single();
  if (error) throw error;

  if (marco) {
    // upsert: reenviar o mesmo marco não duplica a linha
    const { error: erroFollow } = await supabase
      .from("followups")
      .upsert({ lead_id: leadId, dia: marco, por: autor }, { onConflict: "lead_id,dia" });
    if (erroFollow) throw erroFollow;
  }

  return data;
}

// ---------------------------------------------------------------- eventos

export async function registrarEvento({ leadId, usuario, acao, detalhe }) {
  const { error } = await supabase
    .from("eventos")
    .insert({ lead_id: leadId, usuario, acao, detalhe: detalhe?.slice(0, 500) });
  // auditoria falhando não pode travar o atendimento
  if (error) console.warn("Não foi possível registrar o evento:", error.message);
}

export async function carregarEventos(limite = 60) {
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .order("em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data || []).map((e) => ({
    id: e.id,
    leadId: e.lead_id,
    acao: e.acao,
    detalhe: e.detalhe,
    em: e.em,
  }));
}

// ----------------------------------------------------------- configuração

export async function carregarConfig() {
  const { data, error } = await supabase.from("configuracoes").select("dados").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data?.dados || {};
}

export async function salvarConfig(dados) {
  const { error } = await supabase
    .from("configuracoes")
    .upsert({ id: 1, dados, atualizado_em: new Date().toISOString() });
  if (error) throw error;
}

// ---------------------------------------------------------------- perfis

export async function carregarPerfis() {
  const { data, error } = await supabase.from("perfis").select("*").order("criado_em");
  if (error) throw error;
  return (data || []).map(perfilDoBanco);
}

export async function salvarPerfil(id, mudancas) {
  const payload = {};
  if (mudancas.nome !== undefined) payload.nome = mudancas.nome;
  if (mudancas.papel !== undefined) payload.papel = mudancas.papel;
  if (mudancas.situacao !== undefined) payload.situacao = mudancas.situacao;
  if (mudancas.numero !== undefined) payload.numero = mudancas.numero;
  if (!Object.keys(payload).length) return;

  const { error } = await supabase.from("perfis").update(payload).eq("id", id);
  if (error) throw error;
}

export async function marcarAcesso(id) {
  await supabase.from("perfis").update({ ultimo_acesso: new Date().toISOString() }).eq("id", id);
}

// -------------------------------------------------------------- tempo real

/**
 * Avisa quando algo muda no banco — mensagem nova do bridge, lead alterado
 * por outra pessoa da equipe. Devolve a função que cancela a assinatura.
 */
export function observarMudancas(aoMudar) {
  const canal = supabase
    .channel("painel")
    .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, aoMudar)
    .on("postgres_changes", { event: "*", schema: "public", table: "mensagens" }, aoMudar)
    .subscribe();

  return () => supabase.removeChannel(canal);
}
