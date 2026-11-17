import React, { useState, useEffect } from "react";
import Sidebar from "../components/organisms/Sidebar";
import { MetricsGrid } from "../components/organisms/MetricsGrid";
import { ChartsSection } from "../components/organisms/ChartsSection";
import { TopProductsSection } from "../components/organisms/TopProductsSection";

export default function Home_admin(): React.JSX.Element {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setAuthError(null);
        const res = await fetch('/api/v1/admin/dashboard');
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setDashboardData(json.data);
          }
        } else if (res.status === 403 || res.status === 401) {
          const err = await res.json().catch(() => ({}));
          setAuthError(err.message || 'Acesso restrito. Apenas administradores possuem autorização para visualizar este dashboard.');
        }
      } catch (err) {
        console.error('Erro ao buscar dados do dashboard no banco de dados:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  return (
    <div className="flex min-h-screen w-full pe-10 pt-10 bg-slate-50 text-slate-900 antialiased">
      <Sidebar activePage="dashboard" />
      <main className="pl-72 pb-10 flex-1 overflow-y-auto">
        <header className="mb-2">
          <h1 className="text-2xl font-barlow font-bold text-slate-900 tracking-tight">Dashboard Geral</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Indicadores e gráficos calculados em tempo real a partir do banco de dados MySQL
          </p>
        </header>

        {authError ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-xl my-6 flex items-start gap-4">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-600 font-bold shrink-0">⚠️</div>
            <div>
              <h3 className="font-bold text-base text-rose-900">Acesso Restrito / Não Autorizado</h3>
              <p className="text-sm mt-1 text-rose-700">{authError}</p>
              <p className="text-xs text-rose-500 mt-2">
                Conforme a arquitetura de segurança do sistema, apenas contas ativas com perfil de administrador possuem permissão para visualizar e gerenciar estes dados.
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Conectando ao banco de dados MySQL e calculando métricas...
          </div>
        ) : (
          <>
            <MetricsGrid metrics={dashboardData?.metrics} />
            <ChartsSection
              vendasMensais={dashboardData?.vendasMensais}
              categorias={dashboardData?.categorias}
            />
            <TopProductsSection products={dashboardData?.topProdutos} />
          </>
        )}
      </main>
    </div>
  );
}