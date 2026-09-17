// ============================================================================
// Autenticação real, via Supabase Auth.
//
// Diferenças importantes em relação ao modo demonstração:
//   • a senha nunca passa pelo painel — quem valida é o Supabase;
//   • quem decide o que cada um enxerga é a RLS do banco, não o JavaScript;
//   • conta nova entra como `pendente` (gatilho no schema) e só funciona
//     depois que um admin libera;
//   • o painel não apaga contas nem troca a senha dos outros: isso exigiria a
//     chave `service_role`, que não pode viver no navegador. No lugar disso,
//     bloqueia o acesso e envia e-mail de redefinição.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CtxAuth, PERMISSOES } from "./authContexto.js";
import { supabase, traduzErro } from "../services/supabase.js";
import { carregarPerfis, marcarAcesso, salvarPerfil } from "../services/repositorio.js";

export function ProvedorAuthSupabase({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [avisoDeAcesso, setAvisoDeAcesso] = useState(null);
  // evita laço quando a própria saída dispara onAuthStateChange de novo
  const encerrando = useRef(false);
  // enquanto o admin cria a conta de outra pessoa, a sessão troca duas vezes
  // (vira a do novo usuário e volta). Ignorar esses eventos evita que o painel
  // entenda a troca como um login e derrube quem está criando.
  const criandoConta = useRef(false);

  const carregarEquipe = useCallback(async () => {
    try {
      setUsuarios(await carregarPerfis());
    } catch {
      // operador só enxerga o próprio perfil — lista curta é esperada
      setUsuarios((atual) => atual);
    }
  }, []);

  const aplicarSessao = useCallback(
    async (sessao) => {
      if (!sessao?.user) {
        setUsuario(null);
        setUsuarios([]);
        setCarregando(false);
        return;
      }

      const { data, error } = await supabase
        .from("perfis")
        .select("*")
        .eq("id", sessao.user.id)
        .maybeSingle();

      if (error || !data) {
        setAvisoDeAcesso("Não encontramos seu perfil. Fale com o administrador.");
        encerrando.current = true;
        await supabase.auth.signOut();
        encerrando.current = false;
        setUsuario(null);
        setCarregando(false);
        return;
      }

      if (data.situacao !== "ativo") {
        setAvisoDeAcesso(
          data.situacao === "pendente"
            ? "Seu acesso ainda não foi liberado pelo administrador."
            : "Seu acesso foi revogado."
        );
        encerrando.current = true;
        await supabase.auth.signOut();
        encerrando.current = false;
        setUsuario(null);
        setCarregando(false);
        return;
      }

      const perfil = {
        id: data.id,
        nome: data.nome,
        email: data.email,
        papel: data.papel,
        situacao: data.situacao,
        numero: data.numero || "",
        criadoEm: data.criado_em,
        ultimoAcesso: data.ultimo_acesso,
      };

      setAvisoDeAcesso(null);
      setUsuario(perfil);
      setCarregando(false);
      marcarAcesso(perfil.id).catch(() => {});
      carregarEquipe();
    },
    [carregarEquipe]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => aplicarSessao(data.session));

    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (encerrando.current || criandoConta.current) return;
      aplicarSessao(sessao);
    });

    return () => assinatura.subscription.unsubscribe();
  }, [aplicarSessao]);

  // ------------------------------------------------------------------ ações

  const entrar = useCallback(async (email, senha) => {
    setAvisoDeAcesso(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    if (error) return { erro: traduzErro(error) };

    // aplicarSessao roda pelo onAuthStateChange e pode recusar (pendente).
    await aplicarSessao(data.session);
    return { usuario: data.user };
  }, [aplicarSessao]);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setUsuarios([]);
  }, []);

  /**
   * Dois usos no mesmo lugar:
   *
   *   • ninguém logado — é a pessoa se cadastrando. Entra como `pendente` e
   *     espera liberação (a primeira conta do sistema vira admin, pelo gatilho).
   *
   *   • admin logado — está criando a conta de alguém da equipe. Aqui mora uma
   *     armadilha do Supabase: `signUp` troca a sessão ativa pela do usuário
   *     recém-criado. Sem tratamento, o admin sai do próprio painel e vira a
   *     pessoa que acabou de cadastrar — e como ela nasce `pendente`, o painel
   *     ainda a expulsa em seguida. Por isso guardamos a sessão do admin antes
   *     e a devolvemos depois, com os eventos de troca silenciados.
   */
  const cadastrar = useCallback(
    async ({ nome, email, senha }) => {
      const { data: sessaoAntes } = await supabase.auth.getSession();
      const sessaoDoAdmin = sessaoAntes?.session ?? null;

      if (sessaoDoAdmin) criandoConta.current = true;
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: senha,
          options: { data: { nome: nome.trim() } },
        });
        if (error) return { erro: traduzErro(error) };

        if (!sessaoDoAdmin) return { pendente: true };

        const { error: erroVolta } = await supabase.auth.setSession({
          access_token: sessaoDoAdmin.access_token,
          refresh_token: sessaoDoAdmin.refresh_token,
        });
        if (erroVolta) {
          // A conta foi criada, mas não conseguimos voltar para o admin. Sair é
          // mais honesto do que deixá-lo agindo com a identidade de outra pessoa.
          criandoConta.current = false;
          await sair();
          return {
            erro: "A conta foi criada, mas sua sessão expirou. Entre de novo e defina o papel em Usuários.",
          };
        }

        await carregarEquipe();
        return { usuario: data.user };
      } finally {
        criandoConta.current = false;
      }
    },
    [carregarEquipe, sair]
  );

  const atualizarUsuario = useCallback(
    async (id, mudancas) => {
      try {
        await salvarPerfil(id, mudancas);
        await carregarEquipe();
        if (usuario?.id === id) setUsuario((u) => ({ ...u, ...mudancas }));
      } catch (e) {
        return { erro: traduzErro(e) };
      }
    },
    [carregarEquipe, usuario]
  );

  /** Sem service_role não dá para apagar conta. Bloquear é o equivalente seguro. */
  const removerUsuario = useCallback(
    async (id) => {
      await salvarPerfil(id, { situacao: "bloqueado" });
      await carregarEquipe();
    },
    [carregarEquipe]
  );

  /**
   * Para si: troca a senha direto. Para outra pessoa: manda e-mail de
   * redefinição — o painel nunca define a senha de terceiros.
   */
  const trocarSenha = useCallback(
    async (id, nova) => {
      if (id === usuario?.id) {
        const { error } = await supabase.auth.updateUser({ password: nova });
        return error ? { erro: traduzErro(error) } : { ok: "Senha alterada." };
      }

      const alvo = usuarios.find((u) => u.id === id);
      if (!alvo) return { erro: "Usuário não encontrado." };

      const { error } = await supabase.auth.resetPasswordForEmail(alvo.email, {
        redirectTo: `${window.location.origin}/`,
      });
      return error
        ? { erro: traduzErro(error) }
        : { ok: `Enviamos um e-mail de redefinição para ${alvo.email}.` };
    },
    [usuario, usuarios]
  );

  const pode = useCallback(
    (permissao) => !!usuario && PERMISSOES[usuario.papel]?.includes(permissao),
    [usuario]
  );

  const valor = useMemo(
    () => ({
      usuario,
      usuarios,
      carregando,
      avisoDeAcesso,
      entrar,
      sair,
      cadastrar,
      atualizarUsuario,
      removerUsuario,
      trocarSenha,
      pode,
      pendentes: usuarios.filter((u) => u.situacao === "pendente").length,
      ehDemonstracao: false,
    }),
    [usuario, usuarios, carregando, avisoDeAcesso, entrar, sair, cadastrar, atualizarUsuario,
      removerUsuario, trocarSenha, pode]
  );

  return <CtxAuth.Provider value={valor}>{children}</CtxAuth.Provider>;
}
