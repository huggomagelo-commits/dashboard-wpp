import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, BellRing, Clock, Flame, Send, Sparkles, UserPlus } from "lucide-react";
import { useApp } from "../state/store.jsx";
import { useAuth } from "../state/auth.jsx";
import { LeadItem } from "../components/LeadItem.jsx";
import { Aviso, Barra, Chip, Stat, Vazio } from "../components/ui.jsx";
import { contarFunil, dentroDaJanela, proximaJanela } from "../lib/followup.js";
import { hora, primeiroNome } from "../lib/format.js";

function Secao({ titulo, icone: Icone, contagem, acao, children }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">
          <Icone />
          {titulo}
          {contagem > 0 && <span className="tab-count" style={{ background: "var(--surface-3)" }}>{contagem}</span>}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function Hoje() {
  const { filas, leads, config, agora, escopo } = useApp();
  const { usuario, usuarios } = useAuth();
  const navegar = useNavigate();

  const nomeDoDono = (id) => usuarios.find((u) => u.id === id)?.nome.split(" ")[0] || "";

  const criticos = filas.responder.filter((r) => r.analise.urgencia === "critico");
  const funil = contarFunil(leads);
  const janelaAberta = dentroDaJanela(config, agora);
  const abre = proximaJanela(config, agora);

  const saudacao = agora.getHours() < 12 ? "Bom dia" : agora.getHours() < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="page">
      <div className="col gap-4">
        <h2 style={{ fontSize: "1.35rem" }}>
          {saudacao}, {primeiroNome(usuario.nome)}.
        </h2>
        <p className="small muted">
          {filas.responder.length === 0 && filas.followups.length === 0
            ? "Nenhuma pendência no momento. Tudo em dia."
            : `${filas.responder.length} pessoa${filas.responder.length === 1 ? "" : "s"} esperando resposta e ${filas.followups.length} follow-up${filas.followups.length === 1 ? "" : "s"} vencido${filas.followups.length === 1 ? "" : "s"}.`}
        </p>
      </div>

      <div className="grid-stats">
        <Stat valor={criticos.length} rotulo="Resposta crítica" icone={Flame} cor="var(--danger)" onClick={() => navegar("/leads?fila=responder")} />
        <Stat valor={filas.responder.length} rotulo="Aguardando você" icone={Clock} cor="var(--warn)" onClick={() => navegar("/leads?fila=responder")} />
        <Stat valor={filas.novosHoje.length} rotulo="Chegaram hoje" icone={UserPlus} cor="var(--blue-400)" onClick={() => navegar("/leads?fila=hoje")} />
        <Stat valor={filas.followups.length} rotulo="Follow-up vencido" icone={BellRing} cor="var(--blue)" onClick={() => navegar("/follow-ups")} />
      </div>


      {!janelaAberta && (
        <Aviso tipo="warn">
          Fora do horário de atendimento ({config.horaInicio}h às {config.horaFim}h, dias úteis). Você pode responder
          normalmente, mas os disparos de follow-up ficam retidos até <b>{abre.toLocaleDateString("pt-BR", { weekday: "long" })} às {hora(abre)}</b>.
        </Aviso>
      )}

      <Secao
        titulo="Responder agora"
        icone={AlertTriangle}
        contagem={filas.responder.length}
        acao={
          filas.responder.length > 4 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navegar("/leads?fila=responder")}>
              Ver todos <ArrowRight />
            </button>
          )
        }
      >
        {filas.responder.length === 0 ? (
          <Vazio titulo="Ninguém esperando" descricao="Todas as mensagens recebidas já foram respondidas." icone={Sparkles} />
        ) : (
          <div className="lead-list">
            {filas.responder.slice(0, 6).map(({ lead, analise }) => (
              <LeadItem
                key={lead.id}
                lead={lead}
                analise={analise}
                destaque="espera"
                aoAbrir={() => navegar(`/lead/${lead.id}`)}
                mostrarDono={escopo === "todos"}
                dono={nomeDoDono(lead.responsavel)}
              />
            ))}
          </div>
        )}
      </Secao>

      <div className="grid-2">
        <Secao titulo="Chegaram hoje" icone={UserPlus} contagem={filas.novosHoje.length}>
          {filas.novosHoje.length === 0 ? (
            <Vazio titulo="Nenhum lead novo hoje" descricao="Novos contatos do site aparecem aqui." />
          ) : (
            <div className="lead-list">
              {filas.novosHoje.map(({ lead, analise }) => (
                <LeadItem key={lead.id} lead={lead} analise={analise} destaque="espera" aoAbrir={() => navegar(`/lead/${lead.id}`)} />
              ))}
            </div>
          )}
        </Secao>

        <Secao
          titulo="Follow-ups vencidos"
          icone={BellRing}
          contagem={filas.followups.length}
          acao={
            filas.followups.length > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => navegar("/follow-ups")}>
                <Send />
                Revisar fila
              </button>
            )
          }
        >
          {filas.followups.length === 0 ? (
            <Vazio titulo="Cadência em dia" descricao="Nenhum lead atingiu um marco pendente." icone={Sparkles} />
          ) : (
            <div className="lead-list">
              {filas.followups.slice(0, 5).map(({ lead, analise }) => (
                <LeadItem key={lead.id} lead={lead} analise={analise} destaque="marco" aoAbrir={() => navegar(`/lead/${lead.id}`)} />
              ))}
            </div>
          )}
        </Secao>
      </div>

      <section className="card card-pad col gap-12">
        <h2 className="card-title" style={{ marginBottom: 2 }}>
          <Sparkles />
          Funil
        </h2>
        {funil.map((etapa) => (
          <div key={etapa.chave} className="funnel-step">
            <div className="row-between">
              <span className="row gap-8">
                <Chip cor={etapa.cor}>
                  <span className="chip-dot" />
                  {etapa.rotulo}
                </Chip>
              </span>
              <span className="small mono dim">
                {etapa.total} <span className="muted">· {etapa.percentual}%</span>
              </span>
            </div>
            <Barra
              percentual={etapa.percentual}
              cor={
                etapa.cor === "ok" ? "linear-gradient(90deg,#1a8f5c,#2bd98b)"
                  : etapa.cor === "warn" ? "linear-gradient(90deg,#a86f12,#f5a524)"
                  : etapa.cor === "danger" ? "linear-gradient(90deg,#a32133,#f5455c)"
                  : undefined
              }
            />
          </div>
        ))}
      </section>
    </div>
  );
}
