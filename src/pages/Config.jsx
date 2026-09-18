import { useState } from "react";
import { Clock, History, RotateCcw, Save, Shield, SlidersHorizontal, Tags, Timer } from "lucide-react";
import { useApp } from "../state/store.jsx";
import { Aviso, Campo, Chip, Vazio } from "../components/ui.jsx";
import { CONFIG_PADRAO } from "../lib/followup.js";
import { ETIQUETAS_WHATSAPP } from "../data/mock.js";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MARCOS_POSSIVEIS = [1, 2, 3, 5, 7, 10, 15, 21, 30, 45, 60];

export function Config() {
  const { config, setConfig, log, restaurarExemplo, avisar, leads, ignorados } = useApp();
  const [rascunho, setRascunho] = useState(config);

  function alternarEtiquetaDeLead(etiqueta) {
    const etiquetasDeLead = rascunho.etiquetasDeLead.includes(etiqueta)
      ? rascunho.etiquetasDeLead.filter((e) => e !== etiqueta)
      : [...rascunho.etiquetasDeLead, etiqueta];
    setRascunho({ ...rascunho, etiquetasDeLead });
  }

  const mudou = JSON.stringify(rascunho) !== JSON.stringify(config);

  function salvar() {
    setConfig(rascunho);
    avisar("Configurações salvas.", "ok");
  }

  function alternarMarco(dia) {
    const marcos = rascunho.marcos.includes(dia)
      ? rascunho.marcos.filter((m) => m !== dia)
      : [...rascunho.marcos, dia].sort((a, b) => a - b);
    setRascunho({ ...rascunho, marcos });
  }

  function alternarDia(d) {
    const diasUteis = rascunho.diasUteis.includes(d)
      ? rascunho.diasUteis.filter((x) => x !== d)
      : [...rascunho.diasUteis, d].sort();
    setRascunho({ ...rascunho, diasUteis });
  }

  return (
    <div className="page">
      <div className="row-between wrap gap-12">
        <div className="col gap-4">
          <h2 style={{ fontSize: "1.2rem" }}>Configurações</h2>
          <p className="small muted">Regras da cadência, janela de atendimento e travas de segurança.</p>
        </div>
        <div className="row gap-8">
          {mudou && (
            <button type="button" className="btn btn-ghost" onClick={() => setRascunho(config)}>
              Descartar
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={salvar} disabled={!mudou}>
            <Save />
            Salvar
          </button>
        </div>
      </div>

      <section className="card card-pad col gap-14">
        <h3 className="card-title">
          <Tags />
          Quem é lead
        </h3>
        <p className="small muted">
          A retriagem acontece dentro do WhatsApp. O painel só traz as conversas que receberam uma destas etiquetas —
          fornecedor, spam e conversa pessoal ficam de fora sozinhos.
        </p>
        <div className="row gap-6 wrap">
          {ETIQUETAS_WHATSAPP.map((etiqueta) => (
            <Chip
              key={etiqueta}
              data-on={rascunho.etiquetasDeLead.includes(etiqueta)}
              onClick={() => alternarEtiquetaDeLead(etiqueta)}
            >
              {etiqueta}
            </Chip>
          ))}
        </div>
        {rascunho.etiquetasDeLead.length === 0 ? (
          <Aviso tipo="warn">
            Sem nenhuma etiqueta marcada, <b>todas as conversas</b> do WhatsApp entram no painel — inclusive as que não
            são lead.
          </Aviso>
        ) : (
          <span className="tiny muted">
            {ignorados > 0
              ? `${ignorados} conversa${ignorados === 1 ? "" : "s"} fora do painel por não ter etiqueta de lead.`
              : "Nenhuma conversa sendo ignorada no momento."}
          </span>
        )}
      </section>

      <section className="card card-pad col gap-14">
        <h3 className="card-title">
          <Timer />
          Marcos da cadência
        </h3>
        <p className="small muted">
          Dias sem resposta em que um follow-up é proposto. O padrão combinado é 2, 3, 5, 7, 15 e 30.
        </p>
        <div className="row gap-6 wrap">
          {MARCOS_POSSIVEIS.map((dia) => (
            <Chip key={dia} data-on={rascunho.marcos.includes(dia)} onClick={() => alternarMarco(dia)}>
              {dia} dias
            </Chip>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="card card-pad col gap-14">
          <h3 className="card-title">
            <Clock />
            Janela de atendimento
          </h3>
          <div className="row gap-12">
            <Campo rotulo="Início">
              <select className="select" value={rascunho.horaInicio} onChange={(e) => setRascunho({ ...rascunho, horaInicio: +e.target.value })}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Fim">
              <select className="select" value={rascunho.horaFim} onChange={(e) => setRascunho({ ...rascunho, horaFim: +e.target.value })}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="col gap-6">
            <span className="label">Dias de disparo</span>
            <div className="row gap-6 wrap">
              {DIAS.map((d, i) => (
                <Chip key={d} data-on={rascunho.diasUteis.includes(i)} onClick={() => alternarDia(i)}>
                  {d}
                </Chip>
              ))}
            </div>
          </div>
        </section>

        <section className="card card-pad col gap-14">
          <h3 className="card-title">
            <SlidersHorizontal />
            Prazos de resposta (SLA)
          </h3>
          <Campo rotulo="Lead novo vira urgente depois de" dica="Primeira mensagem de alguém que nunca foi respondido.">
            <select className="select" value={rascunho.slaPrimeiraResposta} onChange={(e) => setRascunho({ ...rascunho, slaPrimeiraResposta: +e.target.value })}>
              {[0.25, 0.5, 1, 2, 4].map((h) => (
                <option key={h} value={h}>{h < 1 ? `${h * 60} minutos` : `${h} hora${h > 1 ? "s" : ""}`}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Conversa em andamento vira urgente depois de">
            <select className="select" value={rascunho.slaConversa} onChange={(e) => setRascunho({ ...rascunho, slaConversa: +e.target.value })}>
              {[1, 2, 4, 8, 12, 24].map((h) => (
                <option key={h} value={h}>{h} hora{h > 1 ? "s" : ""}</option>
              ))}
            </select>
          </Campo>
        </section>
      </div>

      <section className="card card-pad col gap-14">
        <h3 className="card-title">
          <Shield />
          Travas de segurança
        </h3>
        <Aviso tipo="warn">
          Estas travas existem para proteger o número de bloqueio e as pessoas de incômodo. Mexer nelas para cima
          aumenta o risco de o WhatsApp derrubar a conta.
        </Aviso>
        <div className="grid-2">
          <Campo rotulo="Teto de disparos por dia">
            <select className="select" value={rascunho.tetoDiario} onChange={(e) => setRascunho({ ...rascunho, tetoDiario: +e.target.value })}>
              {[10, 20, 30, 50, 80, 120].map((n) => (
                <option key={n} value={n}>{n} mensagens</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Intervalo entre disparos" dica="Sorteado dentro da faixa, para não parecer robô.">
            <select
              className="select"
              value={`${rascunho.intervaloMinSegundos}-${rascunho.intervaloMaxSegundos}`}
              onChange={(e) => {
                const [min, max] = e.target.value.split("-").map(Number);
                setRascunho({ ...rascunho, intervaloMinSegundos: min, intervaloMaxSegundos: max });
              }}
            >
              {/* Nada abaixo de 27s: é o piso que o banco impõe no gatilho de
                  espaçamento. Oferecer menos aqui só criaria uma tela que
                  discorda do que acontece de verdade. */}
              <option value="27-48">27 a 48 segundos</option>
              <option value="45-180">45 segundos a 3 minutos</option>
              <option value="120-420">2 a 7 minutos</option>
            </select>
          </Campo>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={rascunho.exigirAprovacao}
            onChange={(e) => setRascunho({ ...rascunho, exigirAprovacao: e.target.checked })}
          />
          <span className="switch-track" />
          <span className="col gap-4">
            <span className="small bold">Exigir aprovação humana em todo follow-up</span>
            <span className="tiny muted">Recomendado. Sem isso, o disparo vira automático de verdade — e o risco sobe muito.</span>
          </span>
        </label>
      </section>

      <section className="card card-pad col gap-12">
        <h3 className="card-title">
          <History />
          Histórico de ações
        </h3>
        {log.length === 0 ? (
          <Vazio titulo="Nada registrado ainda" descricao="Envios, mudanças de status e pausas aparecem aqui." />
        ) : (
          <div className="col gap-8">
            {log.slice(0, 12).map((l) => {
              const lead = leads.find((x) => x.id === l.leadId);
              return (
                <div key={l.id} className="row-between small">
                  <span className="dim truncate">
                    <b>{l.acao}</b> {lead ? `— ${lead.nome}` : ""}
                  </span>
                  <span className="tiny muted mono">{new Date(l.em).toLocaleString("pt-BR")}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card card-pad col gap-12">
        <h3 className="card-title">
          <RotateCcw />
          Dados de exemplo
        </h3>
        <p className="small muted">
          Tudo o que você vê são leads fictícios gerados no navegador. Restaurar recoloca as filas no estado inicial —
          útil depois de testar envios.
        </p>
        <div className="row gap-8 wrap">
          <button type="button" className="btn" onClick={restaurarExemplo}>
            <RotateCcw />
            Restaurar exemplo
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setRascunho(CONFIG_PADRAO)}>
            Voltar às configurações padrão
          </button>
        </div>
      </section>
    </div>
  );
}
