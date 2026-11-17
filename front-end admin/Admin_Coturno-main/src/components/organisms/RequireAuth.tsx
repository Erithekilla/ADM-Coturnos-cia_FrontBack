// src/components/organisms/RequireAuth.tsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LOGIN_PATH, isAuthenticated, verifySession } from '../../lib/auth';

type CheckState = 'checking' | 'ok' | 'denied';

/**
 * Protege as rotas do painel: sem token → login; com token → confirma no
 * servidor (/auth/me) que a sessão ainda é de um administrador ativo.
 */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [state, setState] = useState<CheckState>(isAuthenticated() ? 'checking' : 'denied');

  useEffect(() => {
    if (!isAuthenticated()) {
      setState('denied');
      return;
    }
    let active = true;
    verifySession().then((ok) => {
      if (active) setState(ok ? 'ok' : 'denied');
    });
    return () => {
      active = false;
    };
  }, []);

  if (state === 'denied') {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname }} />;
  }

  if (state === 'checking') {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-500 text-sm">
        Verificando sessão…
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireAuth;
