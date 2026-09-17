// Contexto e regras de permissão, compartilhados pelos dois modos de login
// (demonstração no navegador e Supabase de verdade).

import { createContext, useContext } from "react";

export const CtxAuth = createContext(null);

export const PAPEIS = {
  admin: { rotulo: "Administrador", descricao: "Acesso total, gerencia usuários e configurações." },
  // A chave continua `operador` porque é o valor gravado no banco e usado pela
  // RLS. Só o rótulo mudou, para falar a língua da equipe.
  operador: { rotulo: "Closer", descricao: "Conduz a conversa até a venda e envia follow-ups." },
  sdr: { rotulo: "SDR", descricao: "Faz o primeiro contato, qualifica e prepara o lead." },
  leitor: { rotulo: "Leitor", descricao: "Só visualiza. Não envia mensagem nem altera lead." },
};

// SDR e Closer têm a mesma permissão técnica de propósito: os dois precisam
// ler, responder e disparar follow-up nos próprios leads. O que separa os dois
// é a etapa do funil que cada um trabalha, não o que o sistema deixa fazer.
export const PERMISSOES = {
  admin: ["ver", "atender", "enviar", "configurar", "usuarios"],
  operador: ["ver", "atender", "enviar"],
  sdr: ["ver", "atender", "enviar"],
  leitor: ["ver"],
};

export function useAuth() {
  const ctx = useContext(CtxAuth);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <ProvedorAuth>");
  return ctx;
}
