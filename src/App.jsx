import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ProvedorAuth, useAuth } from "./state/auth.jsx";
import { ProvedorApp } from "./state/store.jsx";
import { Layout } from "./components/Layout.jsx";
import { Login } from "./pages/Login.jsx";
import { Hoje } from "./pages/Hoje.jsx";
import { FollowUps } from "./pages/FollowUps.jsx";
import { Leads } from "./pages/Leads.jsx";
import { Conversa } from "./pages/Conversa.jsx";
import { Conexao } from "./pages/Conexao.jsx";
import { Usuarios } from "./pages/Usuarios.jsx";
import { Config } from "./pages/Config.jsx";

function SomenteAdmin({ permissao, children }) {
  const { pode } = useAuth();
  return pode(permissao) ? children : <Navigate to="/" replace />;
}

function Rotas() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="auth-wrap">
        <Loader2 className="spin" style={{ width: 28, height: 28, color: "var(--blue-400)" }} />
      </div>
    );
  }

  if (!usuario) return <Login />;

  return (
    <ProvedorApp>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Hoje />} />
          <Route path="follow-ups" element={<FollowUps />} />
          <Route path="leads" element={<Leads />} />
          <Route path="lead/:id" element={<Conversa />} />
          <Route path="conexao" element={<Conexao />} />
          <Route
            path="usuarios"
            element={
              <SomenteAdmin permissao="usuarios">
                <Usuarios />
              </SomenteAdmin>
            }
          />
          <Route
            path="config"
            element={
              <SomenteAdmin permissao="configurar">
                <Config />
              </SomenteAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ProvedorApp>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProvedorAuth>
        <Rotas />
      </ProvedorAuth>
    </BrowserRouter>
  );
}
