import React from 'react';
import { cn } from '~/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
}

export default function ProfileStats({ stats }: { stats: StatCardProps[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}

function StatCard({ title, value, icon, trend, subtitle }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border-light bg-surface-primary-alt p-6 transition-all hover:border-border-medium hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-1 text-sm font-medium text-text-secondary">{title}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>}
        </div>
        {icon && (
          <div className="ml-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-tertiary text-text-secondary">
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-1">
          <svg
            className={cn(
              'h-4 w-4',
              trend.isPositive ? 'text-green-600' : 'text-red-600',
              !trend.isPositive && 'rotate-180',
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
          <span
            className={cn(
              'text-sm font-medium',
              trend.isPositive ? 'text-green-600' : 'text-red-600',
            )}
          >
            {Math.abs(trend.value)}%
          </span>
          <span className="ml-1 text-xs text-text-secondary">vs last month</span>
        </div>
      )}
    </div>
  );
}
