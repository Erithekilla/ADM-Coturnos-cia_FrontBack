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
  const defaultMetrics: MetricItem[] = [
    { id: 'receita', label: 'Receita Total', value: 'R$ 0,00', trend: 12.5, bgColor: 'bg-army' },
    { id: 'pedidos', label: 'Pedidos Realizados', value: '0', trend: 8.2, bgColor: 'bg-marrom' },
    { id: 'estoque', label: 'Produtos em Estoque', value: '0', trend: 3.1, bgColor: 'bg-azul' },
    { id: 'clientes', label: 'Clientes Ativos', value: '0', trend: 15.3, bgColor: 'bg-preto' },
  ];

  const items = metrics && metrics.length > 0 ? metrics : defaultMetrics;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-2">
      {items.map((metric) => {
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