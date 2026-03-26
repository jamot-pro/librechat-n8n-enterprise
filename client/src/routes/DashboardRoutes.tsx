import DashboardLayout from '~/layouts/DashboardLayout';
import RouteErrorBoundary from './RouteErrorBoundary';
import OverviewPage from '~/pages/Dashboard/OverviewPage';
import ProjectsPage from '~/pages/Dashboard/ProjectsPage';
import HiringTasksProxyPage from '~/pages/Dashboard/HiringTasksProxyPage';
import TicketsPage from '~/pages/Dashboard/TicketsPage';
import OrdersPage from '~/pages/Dashboard/OrdersPage';
import AnalyticsPage from '~/pages/Dashboard/AnalyticsPage';
import UsersPage from '~/pages/Dashboard/UsersPage';
import AuditPage from '~/pages/Dashboard/AuditPage';
import SocialDraftPage from '~/pages/Dashboard/SocialDraftPage';

const jamotDashboardRoutes = {
  path: 'dashboard',
  element: <DashboardLayout />,
  errorElement: <RouteErrorBoundary />,
  children: [
    { index: true, element: <OverviewPage /> },
    { path: 'projects', element: <ProjectsPage /> },
    { path: 'social-draft', element: <SocialDraftPage /> },
    { path: 'tasks', element: <HiringTasksProxyPage /> },
    { path: 'tickets', element: <TicketsPage /> },
    { path: 'orders', element: <OrdersPage /> },
    { path: 'analytics', element: <AnalyticsPage /> },
    { path: 'users', element: <UsersPage /> },
    { path: 'audit', element: <AuditPage /> },
  ],
};

export default jamotDashboardRoutes;
