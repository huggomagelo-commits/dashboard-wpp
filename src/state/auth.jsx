// Escolhe o modo de autenticação conforme o ambiente:
//   • com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY -> login real, RLS no banco
//   • sem elas -> demonstração, com os dados guardados no navegador
//
// As telas importam sempre daqui e não sabem em qual modo estão.

import { temSupabase } from "../services/supabase.js";
import { ProvedorAuthLocal } from "./authLocal.jsx";
import { ProvedorAuthSupabase } from "./authSupabase.jsx";

export { PAPEIS, PERMISSOES, useAuth } from "./authContexto.js";

export const modoDemonstracao = !temSupabase;

export function ProvedorAuth({ children }) {
  return temSupabase ? (
    <ProvedorAuthSupabase>{children}</ProvedorAuthSupabase>
  ) : (
    <ProvedorAuthLocal>{children}</ProvedorAuthLocal>
  );
}
