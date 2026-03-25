import React, { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Package,
  BarChart3,
  Users,
  Shield,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useFeatureFlags } from '~/hooks/useFeatureFlag';
import { FEATURES } from '~/constants/businesses';
import type { ProfileData } from '~/components/Profile';
import { cn } from '~/utils';

interface MenuItem {
  id: string;
  path: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
  featureFlag?: string;
  end?: boolean;
}

const ALL_MENU_ITEMS: MenuItem[] = [
  { id: 'overview', path: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['ceo', 'employee', 'customer'], end: true },
  { id: 'projects', path: '/dashboard/projects', label: 'Projects', icon: FolderKanban, roles: ['ceo', 'employee', 'customer'] },
  { id: 'tasks', path: '/dashboard/tasks', label: 'Tasks', icon: CheckSquare, roles: ['ceo', 'employee'] },
  { id: 'tickets', path: '/dashboard/tickets', label: 'Tickets', icon: MessageSquare, roles: ['ceo', 'employee', 'customer'] },
  { id: 'orders', path: '/dashboard/orders', label: 'Orders', icon: Package, roles: ['ceo', 'employee'] },
  { id: 'analytics', path: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, roles: ['ceo'] },
  { id: 'users', path: '/dashboard/users', label: 'Users', icon: Users, roles: ['ceo'] },
  { id: 'audit', path: '/dashboard/audit', label: 'Audit', icon: Shield, roles: ['ceo'], featureFlag: FEATURES.AUDIT },
];

interface DashboardSidebarProps {
  profile: ProfileData;
  isOpen: boolean;
  onToggle: () => void;
}

export default function DashboardSidebar({ profile, isOpen, onToggle }: DashboardSidebarProps) {
  const navigate = useNavigate();
  const { features } = useFeatureFlags([FEATURES.AUDIT]);

  const visibleItems = useMemo(() => {
    return ALL_MENU_ITEMS.filter((item) => {
      if (!item.roles.includes(profile.profileType)) return false;
      if (item.featureFlag && !features[item.featureFlag as keyof typeof features]) return false;
      return true;
    });
  }, [profile.profileType, features]);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border-light bg-surface-primary-alt transition-all duration-200',
        isOpen ? 'w-60' : 'w-16',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light px-3 py-4">
        {isOpen && (
          <span className="text-sm font-semibold text-text-primary">Dashboard</span>
        )}
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-surface-active text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                    !isOpen && 'justify-center px-0',
                  )
                }
                title={isOpen ? undefined : item.label}
              >
                <item.icon size={18} className="shrink-0" />
                {isOpen && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border-light px-2 py-3">
        {/* Role badge */}
        {isOpen && (
          <div className="mb-3 px-3">
            <span className="inline-block rounded-full bg-surface-tertiary px-2 py-0.5 text-xs font-medium capitalize text-text-secondary">
              {profile.profileType}
            </span>
          </div>
        )}
        {/* Back to chat */}
        <button
          onClick={() => navigate('/c/new')}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary',
            !isOpen && 'justify-center px-0',
          )}
          title={isOpen ? undefined : 'Back to Chat'}
        >
          <ArrowLeft size={18} className="shrink-0" />
          {isOpen && <span>Back to Chat</span>}
        </button>
      </div>
    </aside>
  );
}
