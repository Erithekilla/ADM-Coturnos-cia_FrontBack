import React from 'react';
import { MetricCard } from '../molecules/MetricCard';
import { CurrencyIcon, CartIcon, BoxIcon, PeopleIcon, IconProps } from '../atoms/Icons';

export interface MetricItem {
  id: string;
  label: string;
  value: string;
  trend: number;
  icon?: React.ComponentType<IconProps>;
  bgColor: string;
}

interface MetricsGridProps {
  metrics?: MetricItem[];
}

const iconMap: Record<string, React.ComponentType<IconProps>> = {
  receita: CurrencyIcon,
  pedidos: CartIcon,
  estoque: BoxIcon,
  clientes: PeopleIcon,
};

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="w-full p-4 mb-2 bg-white rounded-xl border border-slate-200 text-center text-sm text-slate-400">
        Nenhuma métrica disponível no banco de dados.
      </div>
    );
  }

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-2">
      {metrics.map((metric) => {
        const IconComponent = metric.icon || iconMap[metric.id] || BoxIcon;
        return (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            trend={metric.trend}
            icon={IconComponent}
            iconBgColor={metric.bgColor}
          />
        );
      })}
    </section>
  );
};

export default MetricsGrid;