import { useState } from "react";
import { ArrowRight, KeyRound, Loader2, Mail, User, Zap } from "lucide-react";
import { useAuth } from "../state/auth.jsx";
import { Aviso, Campo } from "../components/ui.jsx";

export function Login() {
  const { entrar, cadastrar, avisoDeAcesso, ehDemonstracao } = useAuth();
  const [modo, setModo] = useState("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    setOk("");
    setOcupado(true);
    try {
      if (modo === "entrar") {
        const r = await entrar(email, senha);
        if (r.erro) setErro(r.erro);
      } else {
        if (senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
        const r = await cadastrar({ nome, email, senha });
        if (r.erro) setErro(r.erro);
        else {
          setOk(
            ehDemonstracao
              ? "Cadastro enviado. O administrador precisa liberar seu acesso antes do primeiro login."
              : "Cadastro enviado. Confirme o e-mail que acabamos de mandar e peça ao administrador para liberar seu acesso."
          );
          setModo("entrar");
          setNome("");
          setSenha("");
        }
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="brand-mark">
            <Zap strokeWidth={2.4} />
          </span>
          <div className="col gap-4">
            <h1 style={{ fontSize: "1.3rem" }}>Painel WhatsApp</h1>
            <p className="small muted">Gestão de leads, urgências e follow-up</p>
          </div>
        </div>

        <form className="card card-pad col gap-16" onSubmit={enviar}>
          <div className="tabs">
            <button type="button" className="tab" aria-selected={modo === "entrar"} onClick={() => { setModo("entrar"); setErro(""); }}>
              Entrar
            </button>
            <button type="button" className="tab" aria-selected={modo === "criar"} onClick={() => { setModo("criar"); setErro(""); }}>
              Criar conta
            </button>
          </div>

          {modo === "criar" && (
            <Campo rotulo="Nome completo">
              <div className="search">
                <User />
                <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você se chama" required autoComplete="name" />
              </div>
            </Campo>
          )}

          <Campo rotulo="E-mail">
            <div className="search">
              <Mail />
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required autoComplete="email" />
            </div>
          </Campo>

          <Campo rotulo="Senha" dica={modo === "criar" ? "Mínimo de 6 caracteres." : undefined}>
            <div className="search">
              <KeyRound />
              <input className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" required autoComplete={modo === "criar" ? "new-password" : "current-password"} />
            </div>
          </Campo>

          {(erro || avisoDeAcesso) && (
            <div className="notice notice-warn">
              <span>{erro || avisoDeAcesso}</span>
            </div>
          )}
          {ok && <Aviso>{ok}</Aviso>}

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={ocupado}>
            {ocupado ? <Loader2 className="spin" /> : null}
            {modo === "entrar" ? "Entrar no painel" : "Solicitar acesso"}
            {!ocupado && <ArrowRight />}
          </button>

          {modo === "criar" && (
            <p className="tiny muted" style={{ textAlign: "center" }}>
              Contas novas entram como <b>pendentes</b> e só funcionam depois que o administrador libera.
            </p>
          )}
        </form>

        {ehDemonstracao ? (
          <Aviso tipo="warn">
            <b>Modo demonstração.</b> Acesso de teste: huggomagelo@gmail.com · senha <b>admin1234</b>.
            <br />
            Os dados vivem no seu navegador e o login não é segurança de verdade. Configure{" "}
            <b>VITE_SUPABASE_URL</b> e <b>VITE_SUPABASE_ANON_KEY</b> para ligar o banco real.
          </Aviso>
        ) : (
          <p className="tiny muted" style={{ textAlign: "center" }}>
            A primeira conta criada vira administradora. As seguintes ficam pendentes até serem liberadas.
          </p>
        )}
      </div>
    </div>
  );
}
