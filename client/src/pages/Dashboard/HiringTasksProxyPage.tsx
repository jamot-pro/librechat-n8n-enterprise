import HiringTasksPage from '~/pages/Hiring/TasksPage';

/**
 * Proxy wrapper so we can replace `/dashboard/tasks` with the hiring task board
 * while keeping the original dashboard tasks implementation intact.
 */
export default function HiringTasksProxyPage() {
  return <HiringTasksPage />;
}

