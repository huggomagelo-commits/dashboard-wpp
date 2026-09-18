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
// A variável se chama ANON_KEY por herança. Serve para as duas chaves públicas
// que o Supabase oferece: a `anon` antiga (um JWT) e a `publishable` nova
// (`sb_publishable_…`), que a substitui — o Supabase aposenta a `anon` no fim
// de 2026. Qualquer uma das duas funciona aqui, sem mudar código.
//
// Ser pública é da natureza dela: vai no JavaScript do navegador e não dá
// acesso a nada sozinha — quem protege os dados é a RLS do schema.sql.
//
// O que NUNCA entra aqui é a chave secreta — `service_role` ou `sb_secret_…`.
// Ela ignora a RLS e só pode viver no backend (o bridge, na Fase 3).
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const pareceChave = (v) => /^eyJ[A-Za-z0-9_-]+\./.test(v) || /^sb_(publishable|secret)_/.test(v);
const pareceEndereco = (v) => /^https?:\/\//i.test(v);

/**
 * Por que isto existe: variável *ausente* sempre foi tratada (cai em modo
 * demonstração). Variável *presente e inválida* não era — e um valor errado
 * fazia o createClient lançar durante a importação do módulo, antes do React
 * desenhar qualquer coisa. O resultado era uma página em branco, sem pista
 * nenhuma para quem só vê o site publicado.
 *
 * Aconteceu de verdade, com a URL e a chave trocadas de lugar entre si, que é
 * justamente o engano que os nomes das variáveis convidam a cometer. Por isso
 * a troca tem mensagem própria: é o caso mais provável e o mais confuso.
 */
function conferir() {
  if (!url && !chave) return null; // modo demonstração, proposital
  if (!url) return "Falta VITE_SUPABASE_URL.";
  if (!chave) return "Falta VITE_SUPABASE_ANON_KEY.";

  if (pareceChave(url) && pareceEndereco(chave)) {
    return "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão trocadas entre si.";
  }
  if (!pareceEndereco(url)) {
    return "VITE_SUPABASE_URL precisa começar com https:// — é o Project URL, não a chave.";
  }
  try {
    new URL(url);
  } catch {
    return "VITE_SUPABASE_URL não é um endereço válido.";
  }
  if (url.includes("/rest/v1")) {
    return "VITE_SUPABASE_URL não leva /rest/v1 no fim — use só o Project URL.";
  }
  if (pareceEndereco(chave)) {
    return "VITE_SUPABASE_ANON_KEY recebeu um endereço em vez da chave.";
  }
  return null;
}

/** Mensagem do que está errado na configuração, ou null quando está tudo certo. */
export const problemaDeConfig = conferir();

// Configuração quebrada não derruba o painel: ele volta para o modo
// demonstração e mostra o motivo, que é mais útil do que uma tela branca.
export const temSupabase = Boolean(url && chave) && !problemaDeConfig;

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
