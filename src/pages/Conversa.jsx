import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, BellRing, CalendarClock, Check, Pause, Phone, Play, Send, ShieldOff, Sparkles, Tag,
  UserCircle2,
} from "lucide-react";
import { useApp } from "../state/store.jsx";
import { useAuth } from "../state/auth.jsx";
import { Avatar, Aviso, Campo, Chip, Vazio } from "../components/ui.jsx";
import { STATUS, URGENCIA } from "../lib/followup.js";
import { gerarRascunho, PERFIS, sugestaoDeResposta } from "../lib/templates.js";
import { ETIQUETAS_SUGERIDAS } from "../data/mock.js";
import { dataLonga, diaDaConversa, esperaLonga, hora, telefoneBonito } from "../lib/format.js";

/** Duração em mm:ss. */
function duracao(seg) {
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

/**
 * Mensagem de áudio. Boa parte da triagem chega assim, então o que importa
 * no painel é a transcrição — é dela que sai a informação do lead.
 * Na Fase 4 a transcrição passa a ser gerada de verdade a partir do arquivo.
 */
function Audio({ mensagem }) {
  return (
    <div className="col gap-8">
      <div className="row gap-8">
        <span className="audio-play" aria-hidden="true">
          <Play size={13} />
        </span>
        <span className="audio-onda" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <span key={i} style={{ height: `${25 + ((i * 37) % 70)}%` }} />
          ))}
        </span>
        <span className="tiny mono" style={{ opacity: 0.75 }}>{duracao(mensagem.duracaoSeg)}</span>
      </div>
      {mensagem.transcricao && (
        <div className="audio-transcricao">
          <span className="tiny" style={{ opacity: 0.65 }}>transcrição</span>
          {mensagem.transcricao}
        </div>
      )}
    </div>
  );
}

export function Conversa() {
  const { id } = useParams();
  const navegar = useNavigate();
  const {
    buscarLead, analiseDe, agora, config, enviarMensagem, marcarLido, definirStatus, definirPerfil,
    alternarEtiqueta, pausarCadencia, adiar, definirOptOut, anotar,
  } = useApp();
  const { pode, usuarios } = useAuth();

  const lead = buscarLead(id);
  const analise = analiseDe(id);
  const [texto, setTexto] = useState("");
  const fimDoChat = useRef(null);

  useEffect(() => {
    if (lead?.naoLidas) marcarLido(lead.id);
  }, [lead?.id, lead?.naoLidas, marcarLido]);

  useEffect(() => {
    fimDoChat.current?.scrollIntoView({ block: "end" });
  }, [lead?.mensagens.length]);

  const responsavel = usuarios.find((u) => u.id === lead?.responsavel);

  const etiquetasDisponiveis = useMemo(() => {
    const todas = new Set([...ETIQUETAS_SUGERIDAS, ...(lead?.etiquetas || [])]);
    return [...todas];
  }, [lead]);

  if (!lead || !analise) {
    return (
      <div className="page">
        <section className="card">
          <Vazio titulo="Lead não encontrado" descricao="Ele pode ter sido removido." />
        </section>
      </div>
    );
  }

  function enviar(e) {
    e?.preventDefault();
    const limpo = texto.trim();
    if (!limpo) return;
    enviarMensagem(lead.id, limpo);
    setTexto("");
  }

  // separadores de dia dentro da conversa
  const blocos = [];
  let diaAtual = null;
  for (const m of lead.mensagens) {
    const dia = diaDaConversa(m.em, agora);
    if (dia !== diaAtual) {
      blocos.push({ tipo: "dia", chave: `d-${m.id}`, texto: dia });
      diaAtual = dia;
    }
    blocos.push({ tipo: "msg", chave: m.id, m });
  }

  const urgencia = URGENCIA[analise.urgencia];

  return (
    <div className="page">
      <div className="row gap-12">
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navegar(-1)} aria-label="Voltar">
          <ArrowLeft />
        </button>
        <Avatar nome={lead.nome} tamanho="avatar-lg" />
        <div className="col grow" style={{ minWidth: 0 }}>
          <h2 className="truncate" style={{ fontSize: "1.1rem" }}>{lead.nome}</h2>
          <span className="small muted row gap-6">
            <Phone size={12} />
            {telefoneBonito(lead.telefone)}
            <span className="hide-mobile">· lead desde {dataLonga(lead.criadoEm)}</span>
          </span>
        </div>
        {analise.fila === "responder" && (
          <Chip cor={urgencia.cor}>
            <span className="chip-dot" />
            aguarda {esperaLonga(lead.ultimaMensagem.em, agora)}
          </Chip>
        )}
      </div>

      {lead.optOut && (
        <Aviso tipo="warn">
          Este lead pediu para <b>não receber mais mensagens</b>. Nenhuma cadência roda para ele, e enviar mensagem
          manual aqui só é justificável se ele voltar a te procurar.
        </Aviso>
      )}

      <div className="grid-2 grid-conversa">
        {/* ------------------------------------------------ conversa ---- */}
        <section className="card col" style={{ overflow: "hidden" }}>
          <div className="chat" style={{ maxHeight: 460, minHeight: 260 }}>
            {blocos.map((b) =>
              b.tipo === "dia" ? (
                <span key={b.chave} className="chat-day">{b.texto}</span>
              ) : (
                <div key={b.chave} className={`bubble ${b.m.de === "eu" ? "bubble-me" : "bubble-lead"}`}>
                  {b.m.tipo === "audio" ? <Audio mensagem={b.m} /> : b.m.texto}
                  <span className="bubble-time">{hora(b.m.em)}</span>
                </div>
              )
            )}
            <div ref={fimDoChat} />
          </div>

          <form className="col gap-8" style={{ padding: 14, borderTop: "1px solid var(--line-soft)", background: "var(--bg-elev)" }} onSubmit={enviar}>
            <textarea
              className="textarea"
              placeholder="Escreva sua resposta…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar(e);
              }}
              style={{ minHeight: 76 }}
            />
            <div className="row-between wrap gap-8">
              <div className="row gap-8 wrap">
                <button type="button" className="btn btn-sm" onClick={() => setTexto(sugestaoDeResposta(lead))}>
                  <Sparkles />
                  Sugerir resposta
                </button>
                {analise.proximoMarco && (
                  <button type="button" className="btn btn-sm hide-mobile" onClick={() => setTexto(gerarRascunho(lead, analise.marcoDevido || analise.proximoMarco))}>
                    <BellRing />
                    Rascunho de follow-up
                  </button>
                )}
              </div>
              <button type="submit" className="btn btn-primary" disabled={!texto.trim() || !pode("enviar")}>
                <Send />
                Enviar
              </button>
            </div>
            <span className="tiny muted hide-mobile">Ctrl + Enter envia.</span>
          </form>
        </section>

        {/* -------------------------------------------------- painel ---- */}
        <div className="col gap-16">
          <section className="card card-pad col gap-12">
            <div className="row-between small">
              <span className="row gap-6 muted">
                <UserCircle2 size={14} />
                Atendido por
              </span>
              <span className="col" style={{ alignItems: "flex-end", lineHeight: 1.3 }}>
                <span className="bold">{responsavel?.nome || "—"}</span>
                {responsavel?.numero && (
                  <span className="tiny muted mono">{telefoneBonito(responsavel.numero)}</span>
                )}
              </span>
            </div>

            <Campo rotulo="Etapa do funil">
              <select className="select" value={lead.status} onChange={(e) => definirStatus(lead.id, e.target.value)} disabled={!pode("atender")}>
                {Object.entries(STATUS).map(([chave, s]) => (
                  <option key={chave} value={chave}>{s.rotulo}</option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Perfil / objeção" dica="É o que define o texto dos rascunhos de follow-up.">
              <select className="select" value={lead.perfil} onChange={(e) => definirPerfil(lead.id, e.target.value)} disabled={!pode("atender")}>
                {Object.entries(PERFIS).map(([chave, p]) => (
                  <option key={chave} value={chave}>{p.rotulo} — {p.descricao}</option>
                ))}
              </select>
            </Campo>

            <div className="col gap-8">
              <span className="label row gap-6">
                <Tag size={13} />
                Etiquetas
              </span>
              <div className="row gap-6 wrap">
                {etiquetasDisponiveis.map((e) => (
                  <Chip
                    key={e}
                    data-on={lead.etiquetas.includes(e)}
                    onClick={() => pode("atender") && alternarEtiqueta(lead.id, e)}
                  >
                    {lead.etiquetas.includes(e) && <Check size={11} />}
                    {e}
                  </Chip>
                ))}
              </div>
            </div>
          </section>

          <section className="card card-pad col gap-12">
            <h3 className="card-title">
              <BellRing />
              Cadência
            </h3>

            {analise.bloqueio ? (
              <div className="notice notice-warn"><span>{analise.bloqueio}</span></div>
            ) : analise.fila === "responder" ? (
              <p className="small dim">
                A cadência está parada porque <b>a bola está com você</b> — o lead respondeu por último. Ela volta a
                contar assim que você enviar uma mensagem.
              </p>
            ) : analise.marcoDevido ? (
              <p className="small dim">
                Venceu o marco de <b>dia {analise.marcoDevido}</b> ({analise.diasSemResposta} dias sem resposta).
              </p>
            ) : analise.proximoMarco ? (
              <p className="small dim">
                {analise.diasSemResposta} dia(s) sem resposta. Próximo follow-up no <b>dia {analise.proximoMarco}</b>,
                daqui a {analise.diasAteProximo} dia(s).
              </p>
            ) : (
              <p className="small dim">Cadência concluída — todos os marcos já foram enviados.</p>
            )}

            <div className="row gap-6 wrap">
              {config.marcos.map((dia) => {
                const enviado = analise.marcosEnviados.includes(dia);
                const devido = analise.marcoDevido === dia;
                return (
                  <Chip key={dia} cor={enviado ? "ok" : devido ? "warn" : ""}>
                    {enviado && <Check size={11} />}
                    {dia}d
                  </Chip>
                );
              })}
            </div>

            <div className="row gap-8 wrap">
              <button type="button" className="btn btn-sm" onClick={() => pausarCadencia(lead.id, !lead.cadenciaPausada)} disabled={!pode("atender")}>
                {lead.cadenciaPausada ? <Play /> : <Pause />}
                {lead.cadenciaPausada ? "Retomar" : "Pausar"}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => adiar(lead.id, 3)} disabled={!pode("atender")}>
                <CalendarClock />
                Adiar 3 dias
              </button>
              <button type="button" className={`btn btn-sm ${lead.optOut ? "" : "btn-danger"}`} onClick={() => definirOptOut(lead.id, !lead.optOut)} disabled={!pode("atender")}>
                <ShieldOff />
                {lead.optOut ? "Reativar contato" : "Não perturbe"}
              </button>
            </div>
          </section>

          <section className="card card-pad col gap-8">
            <Campo rotulo="Anotação interna" dica="Só você e sua equipe veem. Não vai para o WhatsApp.">
              <textarea
                className="textarea"
                style={{ minHeight: 72 }}
                value={lead.anotacao}
                onChange={(e) => anotar(lead.id, e.target.value)}
                placeholder="Ex.: prometeu mandar a certidão até sexta"
                disabled={!pode("atender")}
              />
            </Campo>
          </section>

          {lead.followups.length > 0 && (
            <section className="card card-pad col gap-8">
              <h3 className="card-title">
                <Check />
                Follow-ups enviados
              </h3>
              {lead.followups.map((f, i) => (
                <div key={i} className="row-between small">
                  <span className="dim">Marco de {f.dia} dias</span>
                  <span className="muted tiny mono">{new Date(f.em).toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
