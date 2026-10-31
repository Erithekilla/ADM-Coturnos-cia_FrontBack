// src/components/organisms/ChartsSection.tsx
import React from 'react';
import { ChartHeader } from '../molecules/Chartheader';

export interface VendaMensal {
  mes: string;
  vendas: number;
  pedidos: number;
}

export interface CategoriaGrafico {
  nome: string;
  porcentagem: number;
  cor: string;
  classesTexto: string;
}

export interface Coordenada {
  x: number;
  y: number;
}

interface ChartsSectionProps {
  vendasMensais?: VendaMensal[];
  categorias?: CategoriaGrafico[];
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ 
  vendasMensais = [
    { mes: 'Jan', vendas: 0, pedidos: 0 },
    { mes: 'Fev', vendas: 0, pedidos: 0 },
    { mes: 'Mar', vendas: 0, pedidos: 0 },
    { mes: 'Abr', vendas: 0, pedidos: 0 },
    { mes: 'Mai', vendas: 0, pedidos: 0 },
    { mes: 'Jun', vendas: 0, pedidos: 0 },
    { mes: 'Jul', vendas: 0, pedidos: 0 },
    { mes: 'Ago', vendas: 0, pedidos: 0 },
    { mes: 'Set', vendas: 0, pedidos: 0 },
    { mes: 'Out', vendas: 0, pedidos: 0 },
    { mes: 'Nov', vendas: 0, pedidos: 0 },
    { mes: 'Dez', vendas: 0, pedidos: 0 },
  ], 
  categorias = [
    { nome: 'Coturno', porcentagem: 50, cor: '#142952', classesTexto: 'text-azul' },
    { nome: 'Borzeguim', porcentagem: 30, cor: '#4a5c3a', classesTexto: 'text-army' },
    { nome: 'Social', porcentagem: 20, cor: '#000000', classesTexto: 'text-preto' },
  ] 
}) => {
  // --- CONFIGURAÇÕES DO GRÁFICO DE LINHAS (SVG) ---
  const svgWidth = 500;
  const svgHeight = 100;
  
  const maiorValor = Math.max(
    ...vendasMensais.map(v => Math.max(v.vendas, v.pedidos)),
    1000
  );
  const maxValorY = maiorValor > 0 ? maiorValor * 1.15 : 8000;
  const totalPontos = Math.max(vendasMensais.length, 2);

  const obterCoordenadas = (index: number, valor: number): Coordenada => {
    const valorNumerico = Number(valor) || 0;
    const x = 15 + (index / (totalPontos - 1)) * (svgWidth - 30);
    const y = svgHeight - (valorNumerico / maxValorY) * svgHeight;
    return { x, y };
  };

  const pointsVendas = vendasMensais.map((d, i) => obterCoordenadas(i, d.vendas));
  const pointsPedidos = vendasMensais.map((d, i) => obterCoordenadas(i, d.pedidos));

  const gerarCaminhoSuave = (pontos: Coordenada[]): string => {
    if (pontos.length === 0) return '';
    let d = `M ${pontos[0].x} ${pontos[0].y}`;
    for (let i = 0; i < pontos.length - 1; i++) {
      const p0 = pontos[i];
      const p1 = pontos[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (2 * (p1.x - p0.x)) / 3;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const pathVendas = gerarCaminhoSuave(pointsVendas);
  const pathPedidos = gerarCaminhoSuave(pointsPedidos);

  // --- CONFIGURAÇÕES AUXILIARES DO GRÁFICO DE PIZZA (PATH REAL) ---
  const centroX = 16;
  const centroY = 16;
  const raio = 16;

  const obterCoordenadasCirculo = (porcentagem: number): Coordenada => {
    const anguloRadianos = ((porcentagem / 100) * 360 - 90) * (Math.PI / 180);
    return {
      x: centroX + raio * Math.cos(anguloRadianos),
      y: centroY + raio * Math.sin(anguloRadianos)
    };
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 w-full items-start">
      
      {/* Bloco 1: Vendas Mensais */}
      <div className="bg-white pt-6 pe-8 ps-6 pb-5 rounded-xl border border-slate-300 shadow-sm lg:col-span-3 h-70 flex flex-col justify-between">
        <ChartHeader title="Vendas Mensais (Banco de Dados)" />
        
        <div className="w-full flex justify-left items-left gap-4 text-xs font-semibold mt-1">
          <div className="flex items-center gap-1 text-blue-400">
            <span className="font-bold">∘–</span>
            <span>Vendas (R$)</span>
          </div>
          <div className="flex items-center gap-1 text-red">
            <span className="font-bold text-blue">∘–</span>
            <span>Pedidos</span>
          </div>
        </div>

        <div className="w-full flex-1 relative mt-4 flex flex-col justify-between">
          <div className="absolute inset-0 bottom-8 flex flex-col justify-between text-[11px] text-slate-600 font-medium">
            <div className="w-full border-b border-dashed border-slate-600 flex justify-between"><span>{Math.round(maxValorY)}</span></div>
            <div className="w-full border-b border-dashed border-slate-600 flex justify-between"><span>{Math.round(maxValorY * 0.75)}</span></div>
            <div className="w-full border-b border-dashed border-slate-600 flex justify-between"><span>{Math.round(maxValorY * 0.5)}</span></div>
            <div className="w-full border-b border-dashed border-slate-600 flex justify-between"><span>{Math.round(maxValorY * 0.25)}</span></div>
            <div className="w-full border-b border-dashed border-slate-600 flex justify-between"><span>0</span></div>
          </div>

          <div className="w-full h-[75%] mt-2 px-5 relative z-10">
            <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
              <path d={pathPedidos} fill="none" stroke="#142952" strokeWidth="2" />
              {pointsPedidos.map((p, idx) => (
                <circle key={`ped-node-${idx}`} cx={p.x} cy={p.y} r="3" fill="white" stroke="#121212" strokeWidth="2" />
              ))}

              <path d={pathVendas} fill="none" stroke="#1E90FF" strokeWidth="2.5" />
              {pointsVendas.map((p, idx) => (
                <circle key={`ven-node-${idx}`} cx={p.x} cy={p.y} r="3.5" fill="white" stroke="#121212" strokeWidth="2" />
              ))}
            </svg>

            <div className="w-full flex justify-between px-1 text-[10px] text-slate-600 font-medium z-10 mt-3 max-h-1">
              {vendasMensais.map((d, idx) => (
                <span key={`mes-${idx}`}>{d.mes}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bloco 2: Vendas por Categoria */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm lg:col-span-2 flex flex-col h-70 p-5">
        <ChartHeader title="Produtos por Categoria" />
        
        <div className="flex-1 flex items-center justify-center relative mt-4 w-full h-full min-h-0">
          <div className="w-40 h-40 flex items-center justify-center relative">
            
            <div className="w-full h-full">
              <svg className="w-full h-full block overflow-visible" viewBox="0 0 32 32">
                {(() => {
                  let porcentagemAcumulada = 0;
                  
                  return categorias.map((cat, idx) => {
                    const pct = Number(cat.porcentagem) || 0;
                    if (pct <= 0) return null;

                    const inicio = obterCoordenadasCirculo(porcentagemAcumulada);
                    porcentagemAcumulada += pct;
                    const fim = obterCoordenadasCirculo(porcentagemAcumulada);

                    const grandeArcoFlag = pct > 50 ? 1 : 0;

                    const d = `
                      M ${centroX} ${centroY}
                      L ${inicio.x} ${inicio.y}
                      A ${raio} ${raio} 0 ${grandeArcoFlag} 1 ${fim.x} ${fim.y}
                      Z
                    `.trim();

                    return (
                      <path
                        key={`pie-segment-${idx}`}
                        d={d}
                        fill={cat.cor}
                      />
                    );
                  });
                })()}
              </svg>
            </div>

            {/* ETIQUETAS DINÂMICAS */}
            {(() => {
              let faixaInicio = 0;
              return categorias.map((cat, idx) => {
                const pct = Number(cat.porcentagem) || 0;
                if (pct <= 0) return null;
                
                const pontoMedioPct = faixaInicio + (pct / 2);
                faixaInicio += pct;

                const anguloRadianos = ((pontoMedioPct / 100) * 360 - 90) * (Math.PI / 180);
                const raioProjecao = 55; 
                
                const x = 50 + raioProjecao * Math.cos(anguloRadianos);
                const y = 50 + raioProjecao * Math.sin(anguloRadianos);

                return (
                  <span 
                    key={`lbl-dinamica-${idx}`} 
                    className={`absolute text-[10px] sm:text-xs font-semibold ${cat.classesTexto || 'text-slate-800'} bg-white/95 px-1.5 py-0.5 rounded shadow-sm border border-slate-100 z-10 whitespace-nowrap transition-all duration-300`}
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    {cat.nome}: {pct}%
                  </span>
                );
              });
            })()}

          </div>
        </div>
      </div>

    </section>
  );
};

export default ChartsSection;