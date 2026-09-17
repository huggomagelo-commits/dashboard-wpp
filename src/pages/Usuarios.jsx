import { useState } from "react";
import { Check, ShieldCheck, Trash2, UserCheck, UserPlus, UserX } from "lucide-react";
import { useAuth, PAPEIS } from "../state/auth.jsx";
import { useApp } from "../state/store.jsx";
import { Avatar, Aviso, Campo, Chip, Modal, Vazio } from "../components/ui.jsx";
import { telefoneBonito } from "../lib/format.js";

const SITUACOES = {
  ativo: { rotulo: "Ativo", cor: "ok" },
  pendente: { rotulo: "Aguardando liberação", cor: "warn" },
  bloqueado: { rotulo: "Bloqueado", cor: "danger" },
};

export function Usuarios() {
  const { usuario, usuarios, atualizarUsuario, removerUsuario, cadastrar, trocarSenha, ehDemonstracao } = useAuth();
  const { avisar } = useApp();
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", papel: "operador", numero: "" });
  const [erro, setErro] = useState("");
  const [trocando, setTrocando] = useState(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [editandoNumero, setEditandoNumero] = useState(null);
  const [novoNumero, setNovoNumero] = useState("");

  const pendentes = usuarios.filter((u) => u.situacao === "pendente");
  const demais = usuarios.filter((u) => u.situacao !== "pendente");

  async function criar(e) {
    e.preventDefault();
    setErro("");
    if (form.senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
    const r = await cadastrar(form);
    if (r.erro) return setErro(r.erro);
    if (!r.usuario) {
      // Não veio o id da conta nova: dá para criar, mas não para já liberar.
      setNovo(false);
      return avisar("Conta criada. Libere o acesso e defina o papel na lista.", "warn");
    }
    atualizarUsuario(r.usuario.id, {
      papel: form.papel,
      situacao: "ativo",
      numero: form.numero.replace(/\D/g, ""),
    });
    setNovo(false);
    setForm({ nome: "", email: "", senha: "", papel: "operador", numero: "" });
    avisar("Usuário criado e liberado.", "ok");
  }

  function Linha({ u }) {
    const sit = SITUACOES[u.situacao];
    const souEu = u.id === usuario.id;
    return (
      <div className="lead" style={{ cursor: "default" }}>
        <Avatar nome={u.nome} />
        <div className="lead-body">
          <span className="lead-top">
            <span className="lead-name truncate">{u.nome}</span>
            {souEu && <Chip cor="blue">você</Chip>}
          </span>
          <span className="lead-msg truncate">
            {u.email}
            {u.numero ? ` · ${telefoneBonito(u.numero)}` : " · sem número de WhatsApp"}
          </span>
          <span className="row gap-6 wrap" style={{ marginTop: 3 }}>
            <Chip cor={sit.cor}>
              <span className="chip-dot" />
              {sit.rotulo}
            </Chip>
            <Chip>{PAPEIS[u.papel].rotulo}</Chip>
            {u.senhaPadrao && <Chip cor="danger">senha padrão</Chip>}
          </span>
        </div>
        <div className="row gap-6 wrap" style={{ justifyContent: "flex-end" }}>
          {u.situacao === "pendente" && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { atualizarUsuario(u.id, { situacao: "ativo" }); avisar(`${u.nome} liberado.`, "ok"); }}>
              <UserCheck />
              Liberar
            </button>
          )}
          {!souEu && (
            <select
              className="select btn-sm"
              style={{ width: "auto", height: 32, padding: "0 28px 0 10px", fontSize: "0.8125rem" }}
              value={u.papel}
              onChange={(e) => atualizarUsuario(u.id, { papel: e.target.value })}
              aria-label={`Papel de ${u.nome}`}
            >
              {Object.entries(PAPEIS).map(([chave, p]) => (
                <option key={chave} value={chave}>{p.rotulo}</option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn-sm" onClick={() => { setEditandoNumero(u); setNovoNumero(u.numero || ""); }}>
            Número
          </button>
          <button type="button" className="btn btn-sm" onClick={() => { setTrocando(u); setNovaSenha(""); }}>
            Senha
          </button>
          {!souEu && u.situacao === "ativo" && (
            <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => { atualizarUsuario(u.id, { situacao: "bloqueado" }); avisar(`${u.nome} bloqueado.`, "warn"); }} aria-label="Bloquear">
              <UserX />
            </button>
          )}
          {!souEu && u.situacao === "bloqueado" && (
            <button type="button" className="btn btn-sm" onClick={() => atualizarUsuario(u.id, { situacao: "ativo" })}>
              Reativar
            </button>
          )}
          {!souEu && u.id !== "admin" && ehDemonstracao && (
            <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removerUsuario(u.id)} aria-label="Remover">
              <Trash2 />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="row-between wrap gap-12">
        <div className="col gap-4">
          <h2 style={{ fontSize: "1.2rem" }}>Usuários</h2>
          <p className="small muted">Você libera quem entra e define o que cada um pode fazer.</p>
        </div>
        {ehDemonstracao && (
          <button type="button" className="btn btn-primary" onClick={() => setNovo(true)}>
            <UserPlus />
            Criar usuário
          </button>
        )}
      </div>

      {!ehDemonstracao && (
        <Aviso>
          Com o banco real, a pessoa se cadastra pela tela de login e aparece aqui como <b>pendente</b> — você libera,
          define o papel e cadastra o número dela. Bloquear revoga o acesso na hora; excluir conta de vez só pelo
          painel do Supabase, porque exige uma chave que não pode viver no navegador.
        </Aviso>
      )}

      {usuario.senhaPadrao && (
        <Aviso tipo="warn">
          Sua conta ainda está com a <b>senha padrão</b>. Troque agora no botão "Senha" ao lado do seu nome.
        </Aviso>
      )}

      {pendentes.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3 className="card-title">
              <UserPlus />
              Aguardando sua liberação
              <span className="tab-count" style={{ background: "var(--warn)", color: "#1a1204" }}>{pendentes.length}</span>
            </h3>
          </div>
          <div className="lead-list">
            {pendentes.map((u) => (
              <Linha key={u.id} u={u} />
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">
            <ShieldCheck />
            Com acesso
          </h3>
        </div>
        {demais.length === 0 ? (
          <Vazio titulo="Nenhum usuário ativo" />
        ) : (
          <div className="lead-list">
            {demais.map((u) => (
              <Linha key={u.id} u={u} />
            ))}
          </div>
        )}
      </section>

      <section className="card card-pad col gap-8">
        <h3 className="card-title">
          <ShieldCheck />
          O que cada papel pode fazer
        </h3>
        {Object.entries(PAPEIS).map(([chave, p]) => (
          <div key={chave} className="row gap-8">
            <Chip cor={chave === "admin" ? "blue" : ""}>{p.rotulo}</Chip>
            <span className="small muted">{p.descricao}</span>
          </div>
        ))}
      </section>

      {novo && (
        <Modal
          titulo="Criar usuário"
          aoFechar={() => setNovo(false)}
          rodape={
            <>
              <button type="button" className="btn" onClick={() => setNovo(false)}>Cancelar</button>
              <button type="submit" form="form-usuario" className="btn btn-primary">
                <Check />
                Criar e liberar
              </button>
            </>
          }
        >
          <form id="form-usuario" className="col gap-14" onSubmit={criar}>
            <Campo rotulo="Nome">
              <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </Campo>
            <Campo rotulo="E-mail">
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Campo>
            <Campo rotulo="Senha provisória" dica="Peça para a pessoa trocar no primeiro acesso.">
              <input className="input" type="text" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required />
            </Campo>
            <Campo rotulo="Número de WhatsApp" dica="55 + DDD + número. É o número que essa pessoa vai atender.">
              <input className="input" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="5511999990001" />
            </Campo>
            <Campo rotulo="Papel">
              <select className="select" value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value })}>
                {Object.entries(PAPEIS).map(([chave, p]) => (
                  <option key={chave} value={chave}>{p.rotulo} — {p.descricao}</option>
                ))}
              </select>
            </Campo>
            {erro && <div className="notice notice-warn"><span>{erro}</span></div>}
          </form>
        </Modal>
      )}

      {trocando && (() => {
        // Com o banco real, o painel só define a própria senha. Para os outros,
        // manda e-mail de redefinição — ninguém escolhe a senha de ninguém.
        const porEmail = !ehDemonstracao && trocando.id !== usuario.id;
        return (
          <Modal
            titulo={porEmail ? `Redefinir senha — ${trocando.nome}` : `Nova senha — ${trocando.nome}`}
            aoFechar={() => setTrocando(null)}
            rodape={
              <>
                <button type="button" className="btn" onClick={() => setTrocando(null)}>Cancelar</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!porEmail && novaSenha.length < 6) return avisar("Mínimo de 6 caracteres.", "warn");
                    const r = await trocarSenha(trocando.id, novaSenha);
                    setTrocando(null);
                    if (r?.erro) avisar(r.erro, "warn");
                    else avisar(r?.ok || "Senha alterada.", "ok");
                  }}
                >
                  <Check />
                  {porEmail ? "Enviar e-mail" : "Salvar"}
                </button>
              </>
            }
          >
            {porEmail ? (
              <Aviso>
                Vamos enviar um link de redefinição para <b>{trocando.email}</b>. A pessoa escolhe a própria senha —
                o painel nunca fica sabendo dela.
              </Aviso>
            ) : (
              <Campo rotulo="Nova senha" dica="Mínimo de 6 caracteres.">
                <input className="input" type="text" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoFocus />
              </Campo>
            )}
          </Modal>
        );
      })()}

      {editandoNumero && (
        <Modal
          titulo={`Número de WhatsApp — ${editandoNumero.nome}`}
          aoFechar={() => setEditandoNumero(null)}
          rodape={
            <>
              <button type="button" className="btn" onClick={() => setEditandoNumero(null)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const digitos = novoNumero.replace(/\D/g, "");
                  if (digitos && digitos.length < 12) return avisar("Use 55 + DDD + número, só dígitos.", "warn");
                  atualizarUsuario(editandoNumero.id, { numero: digitos });
                  setEditandoNumero(null);
                  avisar("Número atualizado.", "ok");
                }}
              >
                <Check />
                Salvar
              </button>
            </>
          }
        >
          <Campo rotulo="Número que esta pessoa atende" dica="55 + DDD + número, só dígitos. Ex.: 5511999990001">
            <input className="input" value={novoNumero} onChange={(e) => setNovoNumero(e.target.value)} autoFocus />
          </Campo>
          <Aviso>
            É este número que a pessoa vai conectar por QR Code na tela de Conexão. Os leads dela ficam presos a ele.
          </Aviso>
        </Modal>
      )}
    </div>
  );
}
