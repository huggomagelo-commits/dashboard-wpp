import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BellRing, CalendarClock, Check, CheckCheck, Clock, MessageSquare, RefreshCw, Send, Sparkles, SkipForward,
} from "lucide-react";
import { useApp } from "../state/store.jsx";
import { useAuth } from "../state/auth.jsx";
import { Avatar, Aviso, Chip, Vazio } from "../components/ui.jsx";
import { agruparPorMarco, dentroDaJanela } from "../lib/followup.js";
import { gerarRascunho, TOM_DO_MARCO } from "../lib/templates.js";
import { primeiroNome, tempoRelativo } from "../lib/format.js";

export function FollowUps() {
  const { filas, config, agora, enviarMensagem, adiar, pausarCadencia, avisar, enviadosHoje } = useApp();
  const { pode } = useAuth();
  const navegar = useNavigate();

  const [rascunhos, setRascunhos] = useState({});
  const [variantes, setVariantes] = useState({});
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [enviando, setEnviando] = useState(false);

  const grupos = useMemo(() => agruparPorMarco(filas.followups, config), [filas.followups, config]);
  const janelaAberta = dentroDaJanela(config, agora);
  const podeEnviar = pode("enviar");
  const restante = config.tetoDiario - enviadosHoje;

  const textoDe = (lead, marco) => rascunhos[lead.id] ?? gerarRascunho(lead, marco, variantes[lead.id] || 0);

  function editar(id, texto) {
    setRascunhos((r) => ({ ...r, [id]: texto }));
  }

  function regerar(lead, marco) {
    const proxima = (variantes[lead.id] || 0) + 1;
    setVariantes((v) => ({ ...v, [lead.id]: proxima }));
    editar(lead.id, gerarRascunho(lead, marco, proxima));
    avisar("Novo rascunho gerado.", "ok");
  }

  function alternar(id) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selecionarGrupo(itens) {
    const ids = itens.map((i) => i.lead.id);
    const todosMarcados = ids.every((id) => selecionados.has(id));
    setSelecionados((s) => {
      const n = new Set(s);
      ids.forEach((id) => (todosMarcados ? n.delete(id) : n.add(id)));
      return n;
    });
  }

  function enviarUm(lead, marco) {
    enviarMensagem(lead.id, textoDe(lead, marco), { marco });
    setSelecionados((s) => {
      const n = new Set(s);
      n.delete(lead.id);
      return n;
    });
    avisar(`Follow-up de ${primeiroNome(lead.nome)} enviado.`, "ok");
  }

  async function enviarSelecionados() {
    const alvos = filas.followups.filter((f) => selecionados.has(f.lead.id));
    if (!alvos.length) return;
    if (alvos.length > restante) {
      avisar(`O teto diário permite mais ${restante} envio(s) hoje.`, "warn");
      return;
    }
    setEnviando(true);
    for (const { lead, analise } of alvos) {
      enviarMensagem(lead.id, textoDe(lead, analise.marcoDevido), { marco: analise.marcoDevido });
      // no bridge real este intervalo é o espaçamento humano entre disparos
      await new Promise((r) => setTimeout(r, 220));
    }
    setEnviando(false);
    setSelecionados(new Set());
    avisar(`${alvos.length} follow-up(s) enviados.`, "ok");
  }

  return (
    <div className="page">
      <div className="row-between wrap gap-12">
        <div className="col gap-4">
          <h2 style={{ fontSize: "1.2rem" }}>Fila de follow-up</h2>
          <p className="small muted">
            Cada mensagem é um rascunho. Nada sai sem você aprovar.
          </p>
        </div>
        <div className="row gap-8">
          <Chip cor={restante > 5 ? "" : "warn"}>
            <Clock size={12} />
            {enviadosHoje}/{config.tetoDiario} hoje
          </Chip>
          {selecionados.size > 0 && podeEnviar && (
            <button type="button" className="btn btn-primary" onClick={enviarSelecionados} disabled={enviando}>
              {enviando ? <RefreshCw className="spin" /> : <CheckCheck />}
              Aprovar e enviar ({selecionados.size})
            </button>
          )}
        </div>
      </div>

      {!janelaAberta && (
        <Aviso tipo="warn">
          Fora do horário de atendimento. Você ainda pode revisar e aprovar — no funcionamento real (Fase 4) os
          disparos aprovados agora ficam na fila e saem quando a janela abrir.
        </Aviso>
      )}

      {!podeEnviar && <Aviso tipo="warn">Seu perfil não tem permissão para enviar mensagens. Você pode revisar, mas não disparar.</Aviso>}

      {grupos.length === 0 ? (
        <section className="card">
          <Vazio
            titulo="Nenhum follow-up vencido"
            descricao="Quando um lead completar 2, 3, 5, 7, 15 ou 30 dias sem responder, ele aparece aqui com o rascunho pronto."
            icone={Sparkles}
          />
        </section>
      ) : (
        grupos.map((grupo) => {
          const tom = TOM_DO_MARCO[grupo.dia];
          const todosMarcados = grupo.itens.every((i) => selecionados.has(i.lead.id));
          return (
            <section key={grupo.dia} className="card">
              <div className="card-head">
                <div className="col gap-4">
                  <h2 className="card-title">
                    <BellRing />
                    Dia {grupo.dia} · {tom.rotulo}
                    <span className="tab-count" style={{ background: "var(--surface-3)" }}>{grupo.itens.length}</span>
                  </h2>
                  <span className="tiny muted">{tom.intencao}</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => selecionarGrupo(grupo.itens)}>
                  <Check />
                  {todosMarcados ? "Desmarcar" : "Marcar todos"}
                </button>
              </div>

              <div className="col">
                {grupo.itens.map(({ lead, analise }) => {
                  const marcado = selecionados.has(lead.id);
                  return (
                    <div
                      key={lead.id}
                      className="col gap-12"
                      style={{
                        padding: 16,
                        borderBottom: "1px solid var(--line-soft)",
                        background: marcado ? "var(--blue-ghost)" : undefined,
                        transition: "background .16s",
                      }}
                    >
                      <div className="row gap-12">
                        <label className="row" style={{ cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => alternar(lead.id)}
                            style={{ width: 18, height: 18, accentColor: "var(--blue)", cursor: "pointer" }}
                            aria-label={`Selecionar ${lead.nome}`}
                          />
                        </label>
                        <Avatar nome={lead.nome} />
                        <div className="col grow" style={{ minWidth: 0 }}>
                          <button
                            type="button"
                            className="row gap-8"
                            onClick={() => navegar(`/lead/${lead.id}`)}
                            style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "inherit" }}
                          >
                            <span className="lead-name truncate">{lead.nome}</span>
                            <Chip cor="warn">{analise.diasSemResposta} dias sem resposta</Chip>
                          </button>
                          <span className="lead-msg truncate">
                            <span className="me">Você: </span>
                            {lead.ultimaMensagem.texto.replace(/\n/g, " ")}
                          </span>
                          <span className="tiny muted">
                            Último contato {tempoRelativo(lead.ultimaMensagem.em, agora)} ·{" "}
                            {analise.marcosEnviados.length > 0
                              ? `já recebeu os marcos ${analise.marcosEnviados.join(", ")}`
                              : "primeiro follow-up"}
                          </span>
                        </div>
                      </div>

                      <div className="col gap-8">
                        <div className="row-between">
                          <span className="tiny muted row gap-6">
                            <MessageSquare size={12} />
                            Rascunho — edite à vontade antes de enviar
                          </span>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => regerar(lead, grupo.dia)}>
                            <RefreshCw />
                            Outro texto
                          </button>
                        </div>
                        <textarea
                          className="textarea"
                          value={textoDe(lead, grupo.dia)}
                          onChange={(e) => editar(lead.id, e.target.value)}
                          style={{ minHeight: 84 }}
                        />
                        <div className="row gap-8 wrap">
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => enviarUm(lead, grupo.dia)} disabled={!podeEnviar}>
                            <Send />
                            Enviar agora
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => adiar(lead.id, 2)}>
                            <CalendarClock />
                            Adiar 2 dias
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => { pausarCadencia(lead.id, true); avisar("Cadência pausada para este lead.", "ok"); }}>
                            <SkipForward />
                            Pular cadência
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navegar(`/lead/${lead.id}`)}>
                            Ver conversa
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {filas.agendados.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">
              <CalendarClock />
              Próximos da fila
              <span className="tab-count" style={{ background: "var(--surface-3)" }}>{filas.agendados.length}</span>
            </h2>
          </div>
          <div className="lead-list">
            {filas.agendados.slice(0, 6).map(({ lead, analise }) => (
              <div key={lead.id} className="lead" onClick={() => navegar(`/lead/${lead.id}`)} style={{ cursor: "pointer" }}>
                <Avatar nome={lead.nome} tamanho="avatar-sm" />
                <div className="lead-body">
                  <span className="lead-name truncate">{lead.nome}</span>
                  <span className="tiny muted">
                    {analise.diasSemResposta} dia(s) sem resposta · próximo marco: dia {analise.proximoMarco}
                  </span>
                </div>
                <Chip>em {analise.diasAteProximo}d</Chip>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
