// src/pages/Login.tsx
import React, { useState, FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isAuthenticated, login } from '../lib/auth';

interface AdminUserCredential {
  name: string;
  email: string;
  role: string;
  defaultPassword?: string;
}

const ADMIN_USERS: AdminUserCredential[] = [
  {
    name: 'Administrador Coturnos & Cia',
    email: 'admin@coturnos.com.br',
    role: 'Super Admin',
    defaultPassword: 'admin123',
  },
  {
    name: 'Admin Geral',
    email: 'admin@email.com',
    role: 'Administrador',
    defaultPassword: 'admin123',
  },
  {
    name: 'Armando Silva',
    email: 'armandoem@email.com',
    role: 'Administrador',
    defaultPassword: 'admin123',
  },
];

export default function Login(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { from?: string } | null)?.from || '/admin';

  const [email, setEmail] = useState<string>('');
  const [senha, setSenha] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<boolean>(false);

  if (isAuthenticated()) {
    return <Navigate to={destino} replace />;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(email.trim().toLowerCase(), senha);
      navigate(destino === '/admin/login' ? '/admin' : destino, { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao entrar.');
    } finally {
      setEnviando(false);
      setSenha('');
    }
  };

  const handleSelectAdmin = (admin: AdminUserCredential): void => {
    setEmail(admin.email);
    setSenha(admin.defaultPassword || 'admin123');
    setErro(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pretoclaro px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-barlow font-bold text-3xl tracking-wide text-slate-900">Coturnos &amp; Cia</h1>
          <p className="text-sm text-slate-500">Painel administrativo — acesso restrito</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="flex flex-col space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-600">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label htmlFor="senha" className="text-sm font-medium text-slate-600">Senha</label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              className="p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          {erro && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || !email || !senha}
            className="w-full px-4 py-2.5 bg-army hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-lg transition-opacity text-sm shadow-sm"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Usuários Administradores
            </span>
            <span className="text-[11px] text-slate-400">Clique para preencher</span>
          </div>

          <div className="space-y-2">
            {ADMIN_USERS.map((admin) => (
              <button
                key={admin.email}
                type="button"
                onClick={() => handleSelectAdmin(admin)}
                className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors group"
                title={`Preencher com ${admin.email}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {admin.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                    {admin.role}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                  <span className="font-mono text-slate-600">{admin.email}</span>
                  <span className="text-slate-400">
                    Senha: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-semibold">{admin.defaultPassword || 'admin123'}</code>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
