// ============================================================================
// Estado da aplicação: leads, configuração e ações.
//
// Funciona em dois modos, sem que nenhuma tela precise saber em qual está:
//   • demonstração — dados de exemplo guardados no navegador;
//   • Supabase     — banco de verdade, com RLS decidindo o que cada um vê.
//
// Em modo Supabase as ações são otimistas: a tela responde na hora e a
// gravação acontece atrás. Se a gravação falhar, você é avisado.
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { leadsDeExemplo } from "../data/mock.js";
import { analisar, CONFIG_PADRAO, ehLead, montarFilas } from "../lib/followup.js";
import { useAuth } from "./auth.jsx";
import { temSupabase, traduzErro } from "../services/supabase.js";
import * as repo from "../services/repositorio.js";

const CHAVE_LEADS = "painel.leads";
const CHAVE_CONFIG = "painel.config";
const CHAVE_LOG = "painel.log";
const CHAVE_VERSAO = "painel.versao_dados";

/**
 * Suba este número sempre que mudar o formato ou o conteúdo dos dados de
 * exemplo. Quem já tinha o painel aberto recebe o conjunto novo em vez de
 * continuar vendo leads de outro nicho guardados no navegador.
 *   1 — primeira versão
 *   2 — nicho Goffex School (afiliação de nutracêuticos)
 *   3 — dono por lead (cada pessoa no seu número)
 *   4 — mensagens de áudio com transcrição e etiqueta do WhatsApp na triagem
 *   5 — lead perdido continua etiquetado como lead (não some do funil)
 */
const VERSAO_DADOS = 5;

function ler(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* ignora */
  }
}

/** true quando os dados guardados são de uma versão anterior do painel. */
function dadosDesatualizados() {
  return ler(CHAVE_VERSAO, 1) !== VERSAO_DADOS;
}

const Ctx = createContext(null);

export function ProvedorApp({ children }) {
  const { usuario, pode } = useAuth();
  const [desatualizado] = useState(dadosDesatualizados);
  const [leads, setLeads] = useState(() =>
    temSupabase ? [] : desatualizado ? leadsDeExemplo() : ler(CHAVE_LEADS, null) || leadsDeExemplo()
  );
  const [config, definirConfigLocal] = useState(() =>
    desatualizado || temSupabase ? { ...CONFIG_PADRAO } : { ...CONFIG_PADRAO, ...ler(CHAVE_CONFIG, {}) }
  );
  const [log, setLog] = useState(() => (desatualizado || temSupabase ? [] : ler(CHAVE_LOG, [])));
  const [carregandoDados, setCarregandoDados] = useState(temSupabase);

  useEffect(() => {
    if (!temSupabase && desatualizado) gravar(CHAVE_VERSAO, VERSAO_DADOS);
  }, [desatualizado]);

  // espelho do estado para as ações lerem sem virar dependência de hook
  const leadsRef = useRef(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);
  const [conexao, setConexao] = useState({ estado: "desconectado", numero: null, desde: null });
  const [avisos, setAvisos] = useState([]);
  const [agora, setAgora] = useState(() => new Date());
  const timer = useRef(null);

  // o relógio do painel: as filas se movem sozinhas sem recarregar a página
  useEffect(() => {
    timer.current = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(timer.current);
  }, []);

  // No modo demonstração o navegador é o banco.
  useEffect(() => {
    if (!temSupabase) gravar(CHAVE_LEADS, leads);
  }, [leads]);
  useEffect(() => {
    if (!temSupabase) gravar(CHAVE_CONFIG, config);
  }, [config]);
  useEffect(() => {
    if (!temSupabase) gravar(CHAVE_LOG, log.slice(0, 200));
  }, [log]);

  // ---------------------------------------------------------------- avisos
  const avisar = useCallback((texto, tipo = "info") => {
    const id = Math.random().toString(36).slice(2);
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3600);
  }, []);

  const avisarFalha = useCallback(
    (erro) => avisar(traduzErro(erro) || "Não foi possível salvar.", "warn"),
    [avisar]
  );

  // ------------------------------------------------ carga inicial e tempo real
  const recarregar = useCallback(async () => {
    if (!temSupabase) return;
    try {
      const [novosLeads, dadosConfig, eventos] = await Promise.all([
        repo.carregarLeads(),
        repo.carregarConfig(),
        repo.carregarEventos(),
      ]);
      setLeads(novosLeads);
      definirConfigLocal({ ...CONFIG_PADRAO, ...dadosConfig });
      setLog(eventos);
    } catch (e) {
      avisarFalha(e);
    } finally {
      setCarregandoDados(false);
    }
  }, [avisarFalha]);

  useEffect(() => {
    if (!temSupabase || !usuario) return;
    // buscar do banco ao entrar é exatamente "sincronizar com sistema externo",
    // que é para isso que o efeito serve
    // eslint-disable-next-line react/set-state-in-effect
    recarregar();

    // o bridge grava direto no banco; sem isso a fila só anda recarregando
    let agendado = null;
    const cancelar = repo.observarMudancas(() => {
      clearTimeout(agendado);
      agendado = setTimeout(recarregar, 400);
    });
    return () => {
      clearTimeout(agendado);
      cancelar();
    };
  }, [usuario, recarregar]);

  // ------------------------------------------------------------- auditoria
  const registrar = useCallback(
    (acao, leadId, detalhe) => {
      setLog((l) => [
        { id: Math.random().toString(36).slice(2), acao, leadId, detalhe, em: new Date().toISOString() },
        ...l,
      ]);
      if (temSupabase) {
        repo.registrarEvento({ leadId, usuario: usuario?.id, acao, detalhe }).catch(() => {});
      }
    },
    [usuario]
  );

  // ----------------------------------------------------------------- ações
  /**
   * Aplica a mudança na tela na hora e grava atrás. As chaves que não são
   * coluna de `leads` (mensagens, followups) são ignoradas pelo repositório.
   */
  const alterarLead = useCallback(
    (id, mudancas) => {
      const atual = leadsRef.current.find((l) => l.id === id);
      if (!atual) return;
      const patch = typeof mudancas === "function" ? mudancas(atual) : mudancas;

      setLeads((lista) => lista.map((l) => (l.id === id ? { ...l, ...patch } : l)));

      if (temSupabase) repo.salvarLead(id, patch).catch(avisarFalha);
    },
    [avisarFalha]
  );

  /**
   * Registra uma mensagem enviada por nós. É o único caminho de saída —
   * tanto a resposta manual quanto o follow-up passam por aqui.
   */
  const enviarMensagem = useCallback(
    (id, texto, { marco = null } = {}) => {
      const em = new Date().toISOString();
      const autor = usuario?.id ?? "admin";

      alterarLead(id, (l) => ({
        mensagens: [...l.mensagens, { id: `m-${Date.now()}`, de: "eu", tipo: "texto", texto, em }],
        ultimaMensagem: { de: "eu", tipo: "texto", texto, em },
        naoLidas: 0,
        // sair do status "novo" no momento em que respondemos
        status: l.status === "novo" ? "em_conversa" : l.status,
        followups: marco ? [...l.followups, { dia: marco, em, por: autor }] : l.followups,
      }));

      if (temSupabase) {
        repo.gravarMensagem(id, texto, { marco, autor }).catch(avisarFalha);
      }

      registrar(marco ? `follow-up dia ${marco}` : "resposta enviada", id, texto.slice(0, 90));
    },
    [alterarLead, registrar, avisarFalha, usuario]
  );

  /** Simula a chegada de uma mensagem do lead (útil para testar as filas). */
  const receberMensagem = useCallback(
    (id, texto) => {
      const em = new Date().toISOString();
      alterarLead(id, (l) => ({
        mensagens: [...l.mensagens, { id: `m-${Date.now()}`, de: "lead", texto, em }],
        ultimaMensagem: { de: "lead", texto, em },
        naoLidas: l.naoLidas + 1,
        // regra de ouro: o lead respondeu, a cadência para
        followups: [],
        cadenciaPausada: false,
        adiadoAte: null,
      }));
    },
    [alterarLead]
  );

  const marcarLido = useCallback((id) => alterarLead(id, { naoLidas: 0 }), [alterarLead]);

  const definirStatus = useCallback(
    (id, status) => {
      alterarLead(id, { status });
      registrar("status alterado", id, status);
    },
    [alterarLead, registrar]
  );

  /** Perfil de objeção — é o que muda o texto dos rascunhos de follow-up. */
  const definirPerfil = useCallback(
    (id, perfil) => {
      alterarLead(id, { perfil });
      registrar("perfil alterado", id, perfil);
    },
    [alterarLead, registrar]
  );

  const alternarEtiqueta = useCallback(
    (id, etiqueta) => {
      alterarLead(id, (l) => ({
        etiquetas: l.etiquetas.includes(etiqueta)
          ? l.etiquetas.filter((e) => e !== etiqueta)
          : [...l.etiquetas, etiqueta],
      }));
    },
    [alterarLead]
  );

  const pausarCadencia = useCallback(
    (id, pausada) => {
      alterarLead(id, { cadenciaPausada: pausada });
      registrar(pausada ? "cadência pausada" : "cadência retomada", id, "");
    },
    [alterarLead, registrar]
  );

  const adiar = useCallback(
    (id, dias) => {
      const ate = new Date(Date.now() + dias * 86400000).toISOString();
      alterarLead(id, { adiadoAte: ate });
      registrar("adiado", id, `${dias} dia(s)`);
      avisar(`Adiado por ${dias} dia${dias > 1 ? "s" : ""}.`, "ok");
    },
    [alterarLead, registrar, avisar]
  );

  const definirOptOut = useCallback(
    (id, valor) => {
      alterarLead(id, { optOut: valor, cadenciaPausada: valor });
      registrar(valor ? "opt-out registrado" : "opt-out removido", id, "");
    },
    [alterarLead, registrar]
  );

  const anotar = useCallback((id, anotacao) => alterarLead(id, { anotacao }), [alterarLead]);

  const restaurarExemplo = useCallback(() => {
    if (temSupabase) {
      avisar("Com o banco conectado, os dados são reais — não há exemplo a restaurar.", "warn");
      return;
    }
    setLeads(leadsDeExemplo());
    setLog([]);
    avisar("Dados de exemplo restaurados.", "ok");
  }, [avisar]);

  /** Configuração é da operação inteira: no modo Supabase vive no banco. */
  const setConfig = useCallback(
    (novaOuFn) => {
      definirConfigLocal((atual) => {
        const nova = typeof novaOuFn === "function" ? novaOuFn(atual) : novaOuFn;
        if (temSupabase) repo.salvarConfig(nova).catch(avisarFalha);
        return nova;
      });
    },
    [avisarFalha]
  );

  // ----------------------------------------------------------------- filas
  // Cada pessoa da equipe atende no próprio número, então trabalha a própria
  // fila. Só quem administra pode ver a operação inteira.
  const [escopo, setEscopo] = useState("meus");
  const podeVerTudo = pode("usuarios");
  const escopoEfetivo = podeVerTudo ? escopo : "meus";

  // Duas peneiras, nesta ordem: é lead (etiqueta do WhatsApp) e é meu.
  const leadsEtiquetados = useMemo(() => leads.filter((l) => ehLead(l, config)), [leads, config]);
  const ignorados = leads.length - leadsEtiquetados.length;

  const leadsVisiveis = useMemo(
    () =>
      escopoEfetivo === "todos"
        ? leadsEtiquetados
        : leadsEtiquetados.filter((l) => l.responsavel === usuario.id),
    [leadsEtiquetados, escopoEfetivo, usuario.id]
  );

  const filas = useMemo(() => montarFilas(leadsVisiveis, config, agora), [leadsVisiveis, config, agora]);

  /** Análise de um lead mesmo que ele esteja fora do escopo atual. */
  const analiseDe = useCallback(
    (id) => {
      const naFila = filas.analises.get(id);
      if (naFila) return naFila;
      const lead = leads.find((l) => l.id === id);
      return lead ? analisar(lead, config, agora) : null;
    },
    [filas, leads, config, agora]
  );

  const enviadosHoje = useMemo(() => {
    const hoje = new Date().toDateString();
    return log.filter((l) => l.acao.startsWith("follow-up") && new Date(l.em).toDateString() === hoje).length;
  }, [log]);

  const valor = useMemo(
    () => ({
      leads: leadsVisiveis,
      todosLeads: leads,
      escopo: escopoEfetivo,
      setEscopo,
      podeVerTudo,
      ignorados,
      carregandoDados,
      recarregar,
      modoDemonstracao: !temSupabase,
      config,
      setConfig,
      log,
      agora,
      filas,
      analiseDe,
      avisos,
      avisar,
      conexao,
      setConexao,
      enviadosHoje,
      enviarMensagem,
      receberMensagem,
      marcarLido,
      definirStatus,
      definirPerfil,
      alternarEtiqueta,
      pausarCadencia,
      adiar,
      definirOptOut,
      anotar,
      restaurarExemplo,
      buscarLead: (id) => leads.find((l) => l.id === id) || null,
    }),
    [leads, leadsVisiveis, escopoEfetivo, podeVerTudo, ignorados, carregandoDados, recarregar, config, setConfig, log,
      agora, filas, analiseDe, avisos, avisar, conexao, enviadosHoje, enviarMensagem, receberMensagem, marcarLido,
      definirStatus, definirPerfil, alternarEtiqueta, pausarCadencia, adiar, definirOptOut, anotar, restaurarExemplo]
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp precisa estar dentro de <ProvedorApp>");
  return ctx;
}
