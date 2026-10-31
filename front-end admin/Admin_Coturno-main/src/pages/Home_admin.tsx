import React, { useState, useEffect } from "react";
import Sidebar from "../components/organisms/Sidebar";
import { MetricsGrid } from "../components/organisms/MetricsGrid";
import { ChartsSection } from "../components/organisms/ChartsSection";
import { TopProductsSection } from "../components/organisms/TopProductsSection";

export default function Home_admin(): React.JSX.Element {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/v1/admin/dashboard');
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setDashboardData(json.data);
          }
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

        {loading ? (
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