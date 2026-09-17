import { useEffect, useMemo, useState } from "react";
import { Loader2, LogOut, QrCode, RefreshCw, Smartphone, Wifi } from "lucide-react";
import { useApp } from "../state/store.jsx";
import { useAuth } from "../state/auth.jsx";
import { Aviso, Chip } from "../components/ui.jsx";
import { whatsapp } from "../services/whatsapp.js";
import { telefoneBonito } from "../lib/format.js";

/** Desenho de QR a partir do payload — demonstração visual, não é escaneável. */
function QrFalso({ payload }) {
  const celulas = useMemo(() => {
    const n = 25;
    const grade = [];
    let h = 2166136261;
    for (const ch of payload) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    h = (h % 2147483646) + 1;
    for (let i = 0; i < n * n; i++) {
      h = (h * 48271) % 2147483647;
      grade.push((h >>> 3) % 100 < 46);
    }
    // marcadores dos três cantos, como num QR de verdade
    const marcar = (lin, col) => {
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 7; x++) {
          const borda = y === 0 || y === 6 || x === 0 || x === 6;
          const centro = y >= 2 && y <= 4 && x >= 2 && x <= 4;
          grade[(lin + y) * n + (col + x)] = borda || centro;
        }
    };
    marcar(0, 0);
    marcar(0, n - 7);
    marcar(n - 7, 0);
    return { n, grade };
  }, [payload]);

  return (
    <div
      aria-label="Código QR de demonstração"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${celulas.n}, 1fr)`,
        width: "min(260px, 70vw)",
        aspectRatio: "1",
        padding: 12,
        background: "#fff",
        borderRadius: 14,
        gap: 0,
      }}
    >
      {celulas.grade.map((cheio, i) => (
        <span key={i} style={{ background: cheio ? "#05070c" : "transparent" }} />
      ))}
    </div>
  );
}

export function Conexao() {
  const { conexao, setConexao, avisar } = useApp();
  const { pode, usuario, usuarios } = useAuth();
  const [qr, setQr] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    return whatsapp.assinar((evento) => {
      if (evento.tipo === "qr") setQr(evento.qr);
      if (evento.tipo === "conectado") {
        setQr(null);
        setConexao({ estado: "conectado", numero: evento.numero, desde: evento.desde });
        avisar("WhatsApp conectado.", "ok");
      }
      if (evento.tipo === "desconectado") {
        setQr(null);
        setConexao({ estado: "desconectado", numero: null, desde: null });
      }
      if (evento.tipo === "estado") setConexao((c) => ({ ...c, estado: evento.estado }));
    });
  }, [setConexao, avisar]);

  async function conectar() {
    setOcupado(true);
    const r = await whatsapp.conectar();
    setQr(r.qr);
    setConexao((c) => ({ ...c, estado: "aguardando_qr" }));
    setOcupado(false);
  }

  async function simular() {
    setOcupado(true);
    await whatsapp.simularLeitura();
    setOcupado(false);
  }

  async function desconectar() {
    await whatsapp.desconectar();
    avisar("Sessão encerrada.", "warn");
  }

  const conectado = conexao.estado === "conectado";

  const equipe = usuarios.filter((u) => u.situacao === "ativo");

  return (
    <div className="page">
      <Aviso>
        Cada pessoa da equipe atende no <b>próprio número</b>, então cada uma conecta a sua sessão aqui, com o próprio
        login. O código abaixo vincula o número de <b>{usuario.nome}</b>
        {usuario.numero ? ` (${telefoneBonito(usuario.numero)})` : " (número ainda não cadastrado)"}.
      </Aviso>

      <div className="grid-2">
        <section className="card card-pad col gap-16" style={{ alignItems: "center", textAlign: "center" }}>
          {conectado ? (
            <>
              <span className="brand-mark" style={{ width: 54, height: 54, borderRadius: 16, background: "linear-gradient(145deg,#2bd98b,#0f7a4b)" }}>
                <Wifi style={{ width: 26, height: 26 }} />
              </span>
              <div className="col gap-4">
                <h2 style={{ fontSize: "1.1rem" }}>WhatsApp conectado</h2>
                <p className="small muted">
                  Número {telefoneBonito(conexao.numero)} · desde {new Date(conexao.desde).toLocaleString("pt-BR")}
                </p>
              </div>
              <Chip cor="ok">
                <span className="chip-dot" />
                Sessão ativa
              </Chip>
              {pode("configurar") && (
                <button type="button" className="btn btn-danger" onClick={desconectar}>
                  <LogOut />
                  Desconectar
                </button>
              )}
            </>
          ) : qr ? (
            <>
              <QrFalso payload={qr} />
              <div className="col gap-4">
                <h2 style={{ fontSize: "1.05rem" }}>Leia o código no celular</h2>
                <p className="small muted">WhatsApp → Aparelhos conectados → Conectar aparelho</p>
              </div>
              <span className="tiny muted row gap-6">
                <RefreshCw size={12} className="spin" />
                O código se renova a cada 20 segundos
              </span>
              <button type="button" className="btn btn-primary" onClick={simular} disabled={ocupado}>
                {ocupado ? <Loader2 className="spin" /> : <Smartphone />}
                Simular leitura do código
              </button>
            </>
          ) : (
            <>
              <span className="brand-mark" style={{ width: 54, height: 54, borderRadius: 16 }}>
                <QrCode style={{ width: 26, height: 26 }} />
              </span>
              <div className="col gap-4">
                <h2 style={{ fontSize: "1.1rem" }}>WhatsApp desconectado</h2>
                <p className="small muted">Gere o código para vincular o número do atendimento.</p>
              </div>
              <button type="button" className="btn btn-primary btn-lg" onClick={conectar} disabled={ocupado || !pode("configurar")}>
                {ocupado ? <Loader2 className="spin" /> : <QrCode />}
                Gerar código QR
              </button>
              {!pode("configurar") && <span className="tiny muted">Só o administrador pode conectar o número.</span>}
            </>
          )}
        </section>

        <div className="col gap-16">
          <Aviso tipo="warn">
            <b>Esta tela ainda é uma demonstração.</b> O código acima é desenhado localmente e não conecta nada — o
            painel inteiro funciona com dados de exemplo. A conexão real entra na Fase 3, quando subirmos o bridge
            (processo Node rodando 24/7 fora do Netlify), e só o que muda é o arquivo{" "}
            <b>src/services/whatsapp.js</b>. Nenhuma tela precisa ser reescrita.
          </Aviso>

          <section className="card card-pad col gap-10">
            <h3 className="card-title">
              <Smartphone />
              Números da equipe
            </h3>
            {equipe.map((u) => (
              <div key={u.id} className="row-between small">
                <span className="dim truncate">
                  {u.nome}
                  {u.id === usuario.id && <span className="muted"> · você</span>}
                </span>
                <span className="row gap-8">
                  <span className="tiny muted mono">{u.numero ? telefoneBonito(u.numero) : "sem número"}</span>
                  <Chip cor={u.id === usuario.id && conectado ? "ok" : "danger"}>
                    <span className="chip-dot" />
                    {u.id === usuario.id && conectado ? "conectado" : "desconectado"}
                  </Chip>
                </span>
              </div>
            ))}
            <span className="tiny muted">
              Na Fase 3 cada linha acima vira uma sessão independente no bridge. O status de quem não é você só fica
              real quando o backend existir.
            </span>
          </section>

          <section className="card card-pad col gap-12">
            <h3 className="card-title">
              <Smartphone />
              Antes de conectar de verdade
            </h3>
            <ul className="small dim col gap-8" style={{ paddingLeft: 18, margin: 0 }}>
              <li>
                Use um <b>número dedicado ao atendimento</b>, nunca o seu pessoal. A conexão por QR não é oficial do
                WhatsApp, e o risco de bloqueio existe.
              </li>
              <li>
                O celular do número precisa ficar ligado e com internet — é ele que sustenta a sessão.
              </li>
              <li>
                A sessão cai sozinha de tempos em tempos. Quando isso acontecer, o painel avisa e você lê o código de novo.
              </li>
              <li>
                Respeite o teto diário e o horário comercial configurados. Disparo em rajada é o caminho mais rápido
                para o bloqueio.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
