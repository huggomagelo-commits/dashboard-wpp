import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BellRing, LayoutDashboard, LogOut, Settings, Users, Users2, QrCode, Zap,
} from "lucide-react";
import { useAuth } from "../state/auth.jsx";
import { useApp } from "../state/store.jsx";
import { Avatar, Avisos, Chip } from "./ui.jsx";

const PAGINAS = [
  { para: "/", rotulo: "Hoje", icone: LayoutDashboard, fila: "responder" },
  { para: "/follow-ups", rotulo: "Follow-ups", icone: BellRing, fila: "followups" },
  { para: "/leads", rotulo: "Leads", icone: Users2 },
  { para: "/conexao", rotulo: "Conexão", icone: QrCode },
];

const ADMIN = [
  { para: "/usuarios", rotulo: "Usuários", icone: Users, permissao: "usuarios" },
  { para: "/config", rotulo: "Configurações", icone: Settings, permissao: "configurar" },
];

function Marca() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Zap strokeWidth={2.4} />
      </span>
      <span className="col" style={{ lineHeight: 1.15 }}>
        <span className="brand-name">Painel WhatsApp</span>
        <span className="tiny muted">Gestão de leads</span>
      </span>
    </div>
  );
}

function StatusConexao({ compacto = false }) {
  const { conexao } = useApp();
  const mapa = {
    conectado: { cor: "ok", texto: "Conectado" },
    conectando: { cor: "warn", texto: "Conectando" },
    aguardando_qr: { cor: "warn", texto: "Ler QR" },
    desconectado: { cor: "danger", texto: "Desconectado" },
    erro: { cor: "danger", texto: "Erro" },
  };
  const s = mapa[conexao.estado] || mapa.desconectado;
  return (
    <Chip cor={s.cor}>
      <span className="chip-dot" />
      {compacto ? "" : s.texto}
    </Chip>
  );
}

export function Layout() {
  const { usuario, sair, pode, pendentes } = useAuth();
  const { filas, avisos, escopo, setEscopo, podeVerTudo, carregandoDados, modoDemonstracao } = useApp();
  const navegar = useNavigate();
  const { pathname } = useLocation();

  const contagens = {
    responder: filas.responder.length,
    followups: filas.followups.length,
  };

  const titulo =
    [...PAGINAS, ...ADMIN].find((p) => p.para === pathname)?.rotulo ||
    (pathname.startsWith("/lead/") ? "Conversa" : "Painel");

  const itensAdmin = ADMIN.filter((p) => pode(p.permissao));

  return (
    <div className="shell">
      <aside className="sidebar">
        <Marca />

        {PAGINAS.map((p) => (
          <NavLink key={p.para} to={p.para} end={p.para === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <p.icone />
            <span>{p.rotulo}</span>
            {p.fila && contagens[p.fila] > 0 && (
              <span className={`nav-badge ${p.fila === "followups" ? "soft" : ""}`}>{contagens[p.fila]}</span>
            )}
          </NavLink>
        ))}

        {itensAdmin.length > 0 && (
          <>
            <div className="nav-section">Administração</div>
            {itensAdmin.map((p) => (
              <NavLink key={p.para} to={p.para} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <p.icone />
                <span>{p.rotulo}</span>
                {p.para === "/usuarios" && pendentes > 0 && <span className="nav-badge">{pendentes}</span>}
              </NavLink>
            ))}
          </>
        )}

        <div className="sidebar-foot">
          <div className="user-btn">
            <Avatar nome={usuario.nome} tamanho="avatar-sm" />
            <span className="col grow" style={{ minWidth: 0 }}>
              <span className="small bold truncate">{usuario.nome}</span>
              <span className="tiny muted truncate">{usuario.email}</span>
            </span>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => { sair(); navegar("/"); }} aria-label="Sair">
              <LogOut />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row gap-12">
            <span className="only-mobile brand-mark" style={{ width: 28, height: 28, borderRadius: 8 }}>
              <Zap strokeWidth={2.4} style={{ width: 15, height: 15 }} />
            </span>
            <h1 style={{ fontSize: "1.0625rem" }}>{titulo}</h1>
          </div>
          <div className="row gap-8">
            {podeVerTudo && (
              <select
                className="select btn-sm"
                style={{ width: "auto", height: 32, padding: "0 28px 0 10px", fontSize: "0.8125rem" }}
                value={escopo}
                onChange={(e) => setEscopo(e.target.value)}
                aria-label="Escopo dos leads"
              >
                <option value="meus">Meus leads</option>
                <option value="todos">Toda a equipe</option>
              </select>
            )}
            {modoDemonstracao && (
              <span className="hide-mobile">
                <Chip cor="warn">demonstração</Chip>
              </span>
            )}
            <StatusConexao />
            <span className="only-mobile">
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => { sair(); navegar("/"); }} aria-label="Sair">
                <LogOut />
              </button>
            </span>
          </div>
        </header>

        {carregandoDados ? (
          <div className="page">
            <div className="grid-stats">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 84, borderRadius: "var(--r-lg)" }} />
              ))}
            </div>
            <div className="skeleton" style={{ height: 260, borderRadius: "var(--r-lg)" }} />
          </div>
        ) : (
          <Outlet />
        )}
      </div>

      <nav className="bottomnav">
        {PAGINAS.map((p) => (
          <NavLink key={p.para} to={p.para} end={p.para === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            <p.icone />
            <span>{p.rotulo}</span>
            {p.fila && contagens[p.fila] > 0 && (
              <span className={`nav-badge ${p.fila === "followups" ? "soft" : ""}`}>{contagens[p.fila]}</span>
            )}
          </NavLink>
        ))}
        {itensAdmin.length > 0 && (
          <NavLink to="/config" className={({ isActive }) => (isActive || pathname === "/usuarios" ? "active" : "")}>
            <Settings />
            <span>Ajustes</span>
            {pendentes > 0 && <span className="nav-badge">{pendentes}</span>}
          </NavLink>
        )}
      </nav>

      <Avisos lista={avisos} />
    </div>
  );
}
