import { Routes, Route, Navigate } from 'react-router-dom';
import Home_admin from './pages/Home_admin';
import Produtos_Catalogo from './pages/Produtos_Catalogo';
import UsuariosGestao from './pages/UsuariosGestao';
import LogEventos from './pages/LogEventos';
import { EdicaoImagens } from './pages/Edicao_Imagens';
import Pedidos_Listagem from './pages/Pedidos_Listagem';
import Login from './pages/Login';
import RequireAuth from './components/organisms/RequireAuth';

export default function App() {
  return (
    <Routes>
      {/* Redirecionamento inicial da raiz administrativa */}
      <Route path="/" element={<Navigate to="/admin" replace />} />

      {/* Login (única rota pública do painel) */}
      <Route path="/admin/login" element={<Login />} />
      <Route path="/login" element={<Navigate to="/admin/login" replace />} />

      {/* Rotas do Painel Administrativo (exigem sessão de administrador) */}
      <Route path="/admin" element={<RequireAuth><Home_admin /></RequireAuth>} />
      <Route path="/admin/produtos" element={<RequireAuth><Produtos_Catalogo /></RequireAuth>} />
      <Route path="/admin/pedidos" element={<RequireAuth><Pedidos_Listagem /></RequireAuth>} />
      <Route path="/admin/usuarios" element={<RequireAuth><UsuariosGestao /></RequireAuth>} />
      <Route path="/admin/imagens" element={<RequireAuth><EdicaoImagens /></RequireAuth>} />
      <Route path="/admin/logs" element={<RequireAuth><LogEventos /></RequireAuth>} />

      {/* Fallback para páginas não encontradas */}
      <Route path="*" element={
        <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-800">
          <p className="text-lg font-medium">Página não encontrada ou em desenvolvimento.</p>
        </div>
      } />
    </Routes>
  );
}
