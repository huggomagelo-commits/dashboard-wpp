// Linha de lead reaproveitada em todas as filas.

import { BellOff, Mic, PauseCircle, ShieldOff } from "lucide-react";
import { Avatar, Chip } from "./ui.jsx";
import { esperaLonga, tempoRelativo } from "../lib/format.js";
import { STATUS, URGENCIA } from "../lib/followup.js";

export function LeadItem({ lead, analise, aoAbrir, selecionado, acao, destaque = "auto", dono, mostrarDono }) {
  const urgencia = URGENCIA[analise.urgencia];
  const corBorda =
    analise.fila === "responder"
      ? `var(--${urgencia.cor === "danger" ? "danger" : urgencia.cor === "warn" ? "warn" : "blue"})`
      : "var(--blue)";

  return (
    <div className="lead" style={{ "--accent": corBorda }} data-selected={selecionado ? "true" : undefined}>
      <button
        type="button"
        onClick={aoAbrir}
        style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", color: "inherit" }}
      >
        <Avatar nome={lead.nome} />
        <span className="lead-body">
          <span className="lead-top">
            <span className="lead-name truncate">{lead.nome}</span>
            {lead.naoLidas > 0 && <span className="nav-badge" style={{ marginLeft: 0 }}>{lead.naoLidas}</span>}
            {lead.optOut && <ShieldOff size={13} style={{ color: "var(--danger)" }} aria-label="Pediu para não receber mensagens" />}
            {lead.cadenciaPausada && !lead.optOut && <PauseCircle size={13} style={{ color: "var(--warn)" }} aria-label="Cadência pausada" />}
          </span>
          <span className="lead-msg truncate">
            {lead.ultimaMensagem.de === "eu" && <span className="me">Você: </span>}
            {lead.ultimaMensagem.tipo === "audio" && (
              <Mic size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />
            )}
            {lead.ultimaMensagem.texto.replace(/\n/g, " ")}
          </span>
          <span className="row gap-6 wrap" style={{ marginTop: 3 }}>
            <Chip cor={STATUS[lead.status].cor}>
              <span className="chip-dot" />
              {STATUS[lead.status].rotulo}
            </Chip>
            {lead.etiquetas.slice(0, 2).map((e) => (
              <Chip key={e}>{e}</Chip>
            ))}
            {lead.etiquetas.length > 2 && <span className="tiny muted">+{lead.etiquetas.length - 2}</span>}
          </span>
        </span>
      </button>

      <span className="lead-side">
        {destaque === "espera" || (destaque === "auto" && analise.fila === "responder") ? (
          <Chip cor={urgencia.cor}>
            <span className="chip-dot" />
            {esperaLonga(lead.ultimaMensagem.em)}
          </Chip>
        ) : destaque === "marco" && analise.marcoDevido ? (
          <Chip cor="warn">dia {analise.marcoDevido}</Chip>
        ) : destaque === "agendado" && analise.proximoMarco ? (
          <Chip>
            <BellOff size={11} />
            em {analise.diasAteProximo}d
          </Chip>
        ) : (
          <span className="tiny muted mono">{tempoRelativo(lead.ultimaMensagem.em)}</span>
        )}
        {mostrarDono && dono && <span className="tiny muted truncate" style={{ maxWidth: 90 }}>{dono}</span>}
        {acao}
      </span>
    </div>
  );
}
