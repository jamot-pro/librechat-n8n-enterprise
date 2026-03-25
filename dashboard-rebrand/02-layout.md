# Dashboard Rebrand — DashboardLayout

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  DashboardLayout (full viewport, outside chat)         │
│                                                         │
│  ┌──────────┐  ┌────────────────────────────────────┐  │
│  │ Sidebar  │  │ Content Area                       │  │
│  │          │  │                                     │  │
│  │ Overview │  │  ┌──────────────────────────────┐   │  │
│  │ Projects │  │  │ DashboardHeader              │   │  │
│  │ Tasks    │  │  │ (title, breadcrumb, actions) │   │  │
│  │ Tickets  │  │  └──────────────────────────────┘   │  │
│  │ Orders   │  │                                     │  │
│  │ ──────── │  │  ┌──────────────────────────────┐   │  │
│  │ Analytic │  │  │ <Outlet />                   │   │  │
│  │ Users    │  │  │ (page content)               │   │  │
│  │ Audit    │  │  │                              │   │  │
│  │          │  │  └──────────────────────────────┘   │  │
│  │          │  │                                     │  │
│  │ ← Chat  │  │                                     │  │
│  └──────────┘  └────────────────────────────────────┘  │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## DashboardLayout.tsx

**Responsibilities:**
1. Fetch profile via `useProfile()` hook
2. Handle loading / error / no-profile states (reuse from ProfileDashboard)
3. Provide profile context to child routes via `<Outlet context={{ profile }} />`
4. Render sidebar (role-filtered)
5. Render content area with `<Outlet />`
6. Responsive: sidebar collapses to hamburger on mobile

**Skeleton:**

```tsx
export default function DashboardLayout() {
  const { profile, isLoading, error } = useProfile();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoading) return <LoadingState />;
  if (error || !profile) return <ErrorState error={error} />;

  return (
    <div className="flex h-screen bg-surface-primary">
      <DashboardSidebar
        profile={profile}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <main className="flex-1 overflow-y-auto">
        <Outlet context={{ profile }} />
      </main>
    </div>
  );
}
```

**Context hook for pages:**

```tsx
// pages use this to access profile without prop-drilling
export function useDashboardContext() {
  return useOutletContext<{ profile: ProfileData }>();
}
```

---

## DashboardSidebar.tsx

**Menu items definition:**

```tsx
const ALL_MENU_ITEMS = [
  { id: 'overview',  path: '/dashboard',           label: 'Overview',   icon: LayoutDashboard, roles: ['ceo', 'employee', 'customer'] },
  { id: 'projects',  path: '/dashboard/projects',  label: 'Projects',   icon: FolderKanban,    roles: ['ceo', 'employee', 'customer'] },
  { id: 'tasks',     path: '/dashboard/tasks',     label: 'Tasks',      icon: CheckSquare,     roles: ['ceo', 'employee'] },
  { id: 'tickets',   path: '/dashboard/tickets',   label: 'Tickets',    icon: MessageSquare,   roles: ['ceo', 'employee', 'customer'] },
  { id: 'orders',    path: '/dashboard/orders',    label: 'Orders',     icon: Package,         roles: ['ceo', 'employee'] },
  { id: 'analytics', path: '/dashboard/analytics', label: 'Analytics',  icon: BarChart3,       roles: ['ceo'] },
  { id: 'users',     path: '/dashboard/users',     label: 'Users',      icon: Users,           roles: ['ceo'] },
  { id: 'audit',     path: '/dashboard/audit',     label: 'Audit',      icon: Shield,          roles: ['ceo'], featureFlag: 'audit' },
];
```

**Filtering logic:**
```tsx
const visibleItems = ALL_MENU_ITEMS.filter(item => {
  if (!item.roles.includes(profile.profileType)) return false;
  if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
  return true;
});
```

**Footer section:**
- "← Back to Chat" link → `navigate('/c/new')` or just `/`
- Profile info (name, role badge)

**Sidebar width:** 240px expanded, 64px collapsed (icon-only), 0px on mobile (overlay).

**Active state:** `useLocation().pathname` matched against `item.path`. Exact match for `/dashboard`, startsWith for sub-routes.

---

## DashboardHeader.tsx

A simple shared header for each page:

```tsx
interface DashboardHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;  // e.g. "New Project" button
}

export default function DashboardHeader({ title, description, actions }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
```

---

## Route Registration

In `client/src/routes/Dashboard.routes.tsx`:

```tsx
import DashboardLayout from '~/layouts/DashboardLayout';
import OverviewPage from '~/pages/Dashboard/OverviewPage';
import ProjectsPage from '~/pages/Dashboard/ProjectsPage';
// ... etc

const dashboardRoutes = {
  path: 'dashboard',
  element: <DashboardLayout />,
  errorElement: <RouteErrorBoundary />,
  children: [
    { index: true, element: <OverviewPage /> },
    { path: 'projects', element: <ProjectsPage /> },
    { path: 'tasks', element: <TasksPage /> },
    { path: 'tickets', element: <TicketsPage /> },
    { path: 'orders', element: <OrdersPage /> },
    { path: 'analytics', element: <AnalyticsPage /> },
    { path: 'users', element: <UsersPage /> },
    { path: 'audit', element: <AuditPage /> },
  ],
};
```

Registered as a **sibling** to the Root route's children in `routes/index.tsx`, NOT nested under Root (since dashboard has its own layout, not the chat nav).
