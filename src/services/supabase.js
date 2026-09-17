// ============================================================================
// Cliente Supabase.
//
// O painel funciona nos dois modos:
//   • sem as variáveis de ambiente -> modo demonstração (dados no navegador)
//   • com as variáveis            -> banco de verdade, login real, RLS
//
// Isso existe para o site publicado não quebrar enquanto o banco não está
// configurado, e para você conseguir mostrar o painel sem expor dados reais.
//
// A chave `anon` é pública por natureza: ela vai no JavaScript do navegador e
// não dá acesso a nada sozinha — quem protege os dados é a RLS do schema.sql.
// A chave `service_role` NUNCA entra aqui: ela ignora a RLS e só pode viver no
// backend (o bridge, na Fase 3).
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const temSupabase = Boolean(url && chave);

export const supabase = temSupabase
  ? createClient(url, chave, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Mensagem de erro do Supabase traduzida para algo que se lê em português. */
export function traduzErro(erro) {
  if (!erro) return null;
  const m = String(erro.message || erro).toLowerCase();

  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com este e-mail.";
  }
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (m.includes("row-level security") || m.includes("violates row-level")) {
    return "Você não tem permissão para isso.";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror")) {
    return "Sem conexão com o servidor. Verifique sua internet.";
  }
  return erro.message || "Não foi possível completar a operação.";
}
