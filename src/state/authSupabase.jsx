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
      if (encerrando.current) return;
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

  const cadastrar = useCallback(async ({ nome, email, senha }) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: { data: { nome: nome.trim() } },
    });
    if (error) return { erro: traduzErro(error) };
    return { pendente: true };
  }, []);

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
