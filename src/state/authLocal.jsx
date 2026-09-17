// ============================================================================
// Autenticação em modo demonstração (sem Supabase configurado).
//
// Guarda usuários e sessão no localStorage do navegador. É suficiente para
// você validar o fluxo (admin aprova quem entra), mas NÃO é segurança real:
// tudo roda no navegador do usuário.
//
// Quando VITE_SUPABASE_URL existe, quem assume é authSupabase.jsx — com as
// mesmas funções, para nenhuma tela precisar saber em qual modo está.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CtxAuth, PERMISSOES } from "./authContexto.js";

const CHAVE_USUARIOS = "painel.usuarios";
const CHAVE_SESSAO = "painel.sessao";
const CHAVE_VERSAO_USUARIOS = "painel.versao_usuarios";

/**
 * Suba este número ao mudar o formato do usuário. A equipe de exemplo é
 * recriada, preservando a senha do admin.
 *   1 — primeira versão
 *   2 — cada pessoa passou a ter número de WhatsApp próprio
 */
const VERSAO_USUARIOS = 2;

const ADMIN_EMAIL = "huggomagelo@gmail.com";
const ADMIN_SENHA_PADRAO = "admin1234";


async function hash(texto) {
  const dados = new TextEncoder().encode(`painel::${texto}`);
  const buf = await crypto.subtle.digest("SHA-256", dados);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ler(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* modo privado / cota cheia — segue sem persistir */
  }
}

async function semear() {
  const existentes = ler(CHAVE_USUARIOS, null);
  const versaoGuardada = ler(CHAVE_VERSAO_USUARIOS, 1);

  if (existentes?.length && versaoGuardada === VERSAO_USUARIOS) {
    // O admin se autocorrige se o e-mail de acesso mudar no código.
    const desatualizado = existentes.some((u) => u.id === "admin" && u.email !== ADMIN_EMAIL);
    if (!desatualizado) return existentes;

    const corrigidos = existentes.map((u) => (u.id === "admin" ? { ...u, email: ADMIN_EMAIL } : u));
    gravar(CHAVE_USUARIOS, corrigidos);
    return corrigidos;
  }

  // Versão da equipe mudou: recria o time de exemplo, mas preserva a senha
  // do admin, que pode ter sido trocada.
  const adminAntigo = existentes?.find((u) => u.id === "admin");

  const usuarios = [
    {
      id: "admin",
      nome: "Administrador",
      email: ADMIN_EMAIL,
      senha: adminAntigo?.senha ?? (await hash(ADMIN_SENHA_PADRAO)),
      papel: "admin",
      situacao: "ativo",
      // cada pessoa da equipe atende no próprio número
      numero: adminAntigo?.numero || "5511999990001",
      criadoEm: adminAntigo?.criadoEm ?? new Date().toISOString(),
      ultimoAcesso: adminAntigo?.ultimoAcesso ?? null,
      senhaPadrao: adminAntigo ? !!adminAntigo.senhaPadrao : true,
    },
    {
      id: "u-ana",
      nome: "Ana Paula",
      email: "ana@goffex.com.br",
      senha: await hash("123456"),
      papel: "operador",
      situacao: "ativo",
      numero: "5511999990002",
      criadoEm: new Date(Date.now() - 9 * 86400000).toISOString(),
      ultimoAcesso: null,
    },
    {
      id: "u-carlos",
      nome: "Carlos Nunes",
      email: "carlos@goffex.com.br",
      senha: await hash("123456"),
      papel: "operador",
      situacao: "pendente",
      numero: "",
      criadoEm: new Date(Date.now() - 2 * 86400000).toISOString(),
      ultimoAcesso: null,
    },
  ];
  gravar(CHAVE_USUARIOS, usuarios);
  gravar(CHAVE_VERSAO_USUARIOS, VERSAO_USUARIOS);
  return usuarios;
}



export function ProvedorAuthLocal({ children }) {
  const [usuarios, setUsuarios] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Espelho síncrono da lista. `setUsuarios` só vale no próximo render, então
  // duas ações no mesmo clique — criar a conta e já definir o papel dela — leem
  // a lista antiga e a segunda apaga o que a primeira gravou. O ref sempre tem
  // o estado atual, inclusive no meio do clique.
  const usuariosRef = useRef([]);

  useEffect(() => {
    let vivo = true;
    semear().then((lista) => {
      if (!vivo) return;
      usuariosRef.current = lista;
      setUsuarios(lista);
      const id = ler(CHAVE_SESSAO, null);
      const achado = id ? lista.find((u) => u.id === id && u.situacao === "ativo") : null;
      setUsuario(achado || null);
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const salvar = useCallback((lista) => {
    usuariosRef.current = lista;
    setUsuarios(lista);
    gravar(CHAVE_USUARIOS, lista);
  }, []);

  const entrar = useCallback(
    async (email, senha) => {
      const lista = usuariosRef.current;
      const alvo = lista.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!alvo) return { erro: "E-mail ou senha incorretos." };
      if ((await hash(senha)) !== alvo.senha) return { erro: "E-mail ou senha incorretos." };
      if (alvo.situacao === "pendente") return { erro: "Seu acesso ainda não foi liberado pelo administrador." };
      if (alvo.situacao === "bloqueado") return { erro: "Seu acesso foi revogado." };

      const atualizado = { ...alvo, ultimoAcesso: new Date().toISOString() };
      salvar(lista.map((u) => (u.id === alvo.id ? atualizado : u)));
      setUsuario(atualizado);
      gravar(CHAVE_SESSAO, alvo.id);
      return { usuario: atualizado };
    },
    [salvar]
  );

  const sair = useCallback(() => {
    setUsuario(null);
    try {
      localStorage.removeItem(CHAVE_SESSAO);
    } catch {
      /* ignora */
    }
  }, []);

  const cadastrar = useCallback(
    async ({ nome, email, senha }) => {
      const lista = usuariosRef.current;
      const limpo = email.trim().toLowerCase();
      if (lista.some((u) => u.email.toLowerCase() === limpo)) {
        return { erro: "Já existe uma conta com este e-mail." };
      }
      const novo = {
        id: `u-${Date.now().toString(36)}`,
        nome: nome.trim(),
        email: limpo,
        senha: await hash(senha),
        papel: "operador",
        situacao: "pendente",
        criadoEm: new Date().toISOString(),
        ultimoAcesso: null,
      };
      salvar([...lista, novo]);
      return { usuario: novo };
    },
    [salvar]
  );

  const atualizarUsuario = useCallback(
    (id, mudancas) => {
      const lista = usuariosRef.current.map((u) => (u.id === id ? { ...u, ...mudancas } : u));
      salvar(lista);
      if (usuario?.id === id) setUsuario(lista.find((u) => u.id === id));
    },
    [salvar, usuario]
  );

  const removerUsuario = useCallback(
    (id) => {
      if (id === "admin") return;
      salvar(usuariosRef.current.filter((u) => u.id !== id));
    },
    [salvar]
  );

  const trocarSenha = useCallback(
    async (id, nova) => {
      atualizarUsuario(id, { senha: await hash(nova), senhaPadrao: false });
    },
    [atualizarUsuario]
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
      entrar,
      sair,
      cadastrar,
      atualizarUsuario,
      removerUsuario,
      trocarSenha,
      pode,
      pendentes: usuarios.filter((u) => u.situacao === "pendente").length,
      avisoDeAcesso: null,
      ehDemonstracao: true,
    }),
    [usuario, usuarios, carregando, entrar, sair, cadastrar, atualizarUsuario, removerUsuario, trocarSenha, pode]
  );

  return <CtxAuth.Provider value={valor}>{children}</CtxAuth.Provider>;
}

/** Este modo guarda tudo no navegador — deixa a interface avisar. */
export const ehDemonstracao = true;
