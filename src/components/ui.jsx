// Peças visuais reaproveitadas em todas as telas.

import { useEffect } from "react";
import { AlertTriangle, Check, Info, Inbox, X } from "lucide-react";
import { corDoNome, iniciais } from "../lib/format.js";

export function Avatar({ nome, tamanho = "", online = null }) {
  return (
    <div className={`avatar ${tamanho}`} style={{ background: corDoNome(nome) }} aria-hidden="true">
      {iniciais(nome)}
      {online !== null && (
        <span className="avatar-badge" style={{ background: online ? "var(--ok)" : "var(--muted)" }} />
      )}
    </div>
  );
}

export function Chip({ cor = "", children, ...resto }) {
  const classe = `chip ${cor ? `chip-${cor}` : ""}`;
  if (resto.onClick) return <button type="button" className={classe} {...resto}>{children}</button>;
  return <span className={classe} {...resto}>{children}</span>;
}

export function Stat({ valor, rotulo, icone: Icone, cor = "var(--blue)", ativo, ...resto }) {
  return (
    <button type="button" className="stat" data-active={ativo ? "true" : undefined} style={{ "--accent": cor }} {...resto}>
      {Icone && <Icone className="stat-icon" />}
      <span className="stat-value" style={{ color: valor > 0 ? cor : "var(--text)" }}>{valor}</span>
      <span className="stat-label">{rotulo}</span>
    </button>
  );
}

export function Vazio({ titulo, descricao, icone: Icone = Inbox }) {
  return (
    <div className="empty">
      <Icone />
      <span className="empty-title">{titulo}</span>
      {descricao && <span className="small">{descricao}</span>}
    </div>
  );
}

export function Aviso({ tipo = "info", children }) {
  const Icone = tipo === "warn" ? AlertTriangle : Info;
  return (
    <div className={`notice ${tipo === "warn" ? "notice-warn" : ""}`}>
      <Icone />
      <div>{children}</div>
    </div>
  );
}

export function Campo({ rotulo, dica, children }) {
  return (
    <label className="field">
      {rotulo && <span className="label">{rotulo}</span>}
      {children}
      {dica && <span className="tiny muted">{dica}</span>}
    </label>
  );
}

export function Modal({ titulo, aoFechar, largo = false, rodape, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", onKey);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = anterior;
    };
  }, [aoFechar]);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={`modal ${largo ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-head">
          <h2 style={{ fontSize: "1rem" }}>{titulo}</h2>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={aoFechar} aria-label="Fechar">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {rodape && <div className="modal-foot">{rodape}</div>}
      </div>
    </div>
  );
}

export function Avisos({ lista }) {
  return (
    <div className="toasts">
      {lista.map((a) => {
        const Icone = a.tipo === "ok" ? Check : a.tipo === "warn" ? AlertTriangle : Info;
        return (
          <div key={a.id} className={`toast ${a.tipo === "ok" ? "toast-ok" : a.tipo === "warn" ? "toast-warn" : ""}`}>
            <Icone />
            <span>{a.texto}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Barra({ percentual, cor }) {
  return (
    <div className="bar">
      <span style={{ width: `${Math.max(2, percentual)}%`, background: cor }} />
    </div>
  );
}
