import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Filter, Search, Users2, X } from "lucide-react";
import { useApp } from "../state/store.jsx";
import { LeadItem } from "../components/LeadItem.jsx";
import { Chip, Vazio } from "../components/ui.jsx";
import { etiquetasEmUso, STATUS } from "../lib/followup.js";

const FILAS = [
  { chave: "todos", rotulo: "Todos" },
  { chave: "responder", rotulo: "Aguardando" },
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "followup", rotulo: "Follow-up" },
  { chave: "agendado", rotulo: "Agendados" },
  { chave: "bloqueado", rotulo: "Pausados" },
];

/** Última atividade do lead: a mensagem mais recente ou, se não houver, a entrada. */
const atividadeDe = (lead) => lead.ultimaMensagem?.em || lead.criadoEm;

export function Leads() {
  const { leads, filas } = useApp();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();

  const fila = params.get("fila") || "todos";
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [etiqueta, setEtiqueta] = useState("");

  const etiquetas = useMemo(() => etiquetasEmUso(leads), [leads]);

  const contagens = useMemo(
    () => ({
      todos: leads.length,
      responder: filas.responder.length,
      hoje: filas.novosHoje.length,
      followup: filas.followups.length,
      agendado: filas.agendados.length,
      bloqueado: filas.bloqueados.length,
    }),
    [leads, filas]
  );

  const lista = useMemo(() => {
    let base = leads.map((lead) => ({ lead, analise: filas.analises.get(lead.id) }));

    if (fila === "responder") base = filas.responder;
    else if (fila === "hoje") base = filas.novosHoje;
    else if (fila === "followup") base = filas.followups;
    else if (fila === "agendado") base = filas.agendados;
    else if (fila === "bloqueado") base = [...filas.bloqueados, ...filas.esgotados];

    const termo = busca.trim().toLowerCase();
    return base
      .filter(({ lead }) => {
        if (status && lead.status !== status) return false;
        if (etiqueta && !lead.etiquetas.includes(etiqueta)) return false;
        if (!termo) return true;
        return (
          lead.nome.toLowerCase().includes(termo) ||
          lead.telefone.includes(termo.replace(/\D/g, "")) ||
          (lead.ultimaMensagem?.texto || "").toLowerCase().includes(termo)
        );
      })
      // lead do formulário ainda não tem mensagem: ordena pela entrada
      .sort((a, b) => new Date(atividadeDe(b.lead)) - new Date(atividadeDe(a.lead)));
  }, [leads, filas, fila, busca, status, etiqueta]);

  const temFiltro = status || etiqueta || busca;

  return (
    <div className="page">
      <div className="search">
        <Search />
        <input
          className="input"
          placeholder="Buscar por nome, telefone ou conteúdo da conversa"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="tabs">
        {FILAS.map((f) => (
          <button
            key={f.chave}
            type="button"
            className="tab"
            aria-selected={fila === f.chave}
            onClick={() => setParams(f.chave === "todos" ? {} : { fila: f.chave })}
          >
            {f.rotulo}
            {contagens[f.chave] > 0 && <span className="tab-count">{contagens[f.chave]}</span>}
          </button>
        ))}
      </div>

      <div className="row gap-8 wrap">
        <span className="row gap-6 tiny muted">
          <Filter size={13} />
          Filtros:
        </span>
        <select className="select" style={{ width: "auto" }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS).map(([chave, s]) => (
            <option key={chave} value={chave}>{s.rotulo}</option>
          ))}
        </select>
        {etiquetas.slice(0, 8).map((e) => (
          <Chip key={e.nome} data-on={etiqueta === e.nome} onClick={() => setEtiqueta(etiqueta === e.nome ? "" : e.nome)}>
            {e.nome}
            <span className="muted">{e.total}</span>
          </Chip>
        ))}
        {temFiltro && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setBusca(""); setStatus(""); setEtiqueta(""); }}>
            <X />
            Limpar
          </button>
        )}
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">
            <Users2 />
            {lista.length} lead{lista.length === 1 ? "" : "s"}
          </h2>
        </div>
        {lista.length === 0 ? (
          <Vazio titulo="Nada por aqui" descricao="Ajuste os filtros ou a busca." />
        ) : (
          <div className="lead-list">
            {lista.map(({ lead, analise }) => (
              <LeadItem key={lead.id} lead={lead} analise={analise} aoAbrir={() => navegar(`/lead/${lead.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
