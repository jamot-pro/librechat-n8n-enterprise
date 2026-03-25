import DashboardLayout from '~/layouts/DashboardLayout';
import RouteErrorBoundary from './RouteErrorBoundary';
import OverviewPage from '~/pages/Dashboard/OverviewPage';
import ProjectsPage from '~/pages/Dashboard/ProjectsPage';
import TasksPage from '~/pages/Dashboard/TasksPage';
import TicketsPage from '~/pages/Dashboard/TicketsPage';
import OrdersPage from '~/pages/Dashboard/OrdersPage';
import AnalyticsPage from '~/pages/Dashboard/AnalyticsPage';
import UsersPage from '~/pages/Dashboard/UsersPage';
import AuditPage from '~/pages/Dashboard/AuditPage';

const jamotDashboardRoutes = {
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

export default jamotDashboardRoutes;
