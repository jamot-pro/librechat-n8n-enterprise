import DashboardHeader from '~/components/Dashboard/DashboardHeader';
import { useDashboardContext } from '~/layouts/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import CEOKpiStats from '~/components/Profile/CEO/CEOKpiStats';
import CEOProjectsTable from '~/components/Profile/CEO/CEOProjectsTable';
import CEOSignageOrdersWidget from '~/components/Profile/CEO/CEOSignageOrdersWidget';
import ProfileStats from '~/components/Profile/ProfileStats';
import { useOperationalData } from '~/hooks/useOperationalData';
import { useTickets } from '~/hooks/useTickets';
import { useAuthContext } from '~/hooks/AuthContext';
import { useState, useEffect, useMemo } from 'react';

const n8nBaseUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://nadyaputriast-n8n.hf.space';

function CEOOverview() {
  const { profile } = useDashboardContext();
  const { token } = useAuthContext();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [projectsRes, tasksRes, ticketsRes, ordersRes] = await Promise.allSettled([
          fetch(`${n8nBaseUrl}/webhook/librechat/project-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileType: 'ceo', action: 'list' }),
          }).then((r) => r.json()),
          fetch(`${n8nBaseUrl}/webhook/librechat/task-management`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }).then((r) => r.json()),
          fetch(`${n8nBaseUrl}/webhook/librechat/support-ticket-list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'admin' }),
          }).then((r) => r.json()),
          fetch('/api/signage/orders', {
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).then((r) => r.json()),
        ]);

        if (projectsRes.status === 'fulfilled') {
          const d = projectsRes.value;
          setProjects(d?.data?.projects || (Array.isArray(d) ? d : d?.data || []));
        }
        if (tasksRes.status === 'fulfilled') {
          setTasks(tasksRes.value?.tasks || []);
        }
        if (ticketsRes.status === 'fulfilled') {
          setTickets(ticketsRes.value?.data || []);
        }
        if (ordersRes.status === 'fulfilled') {
          const d = ordersRes.value;
          setOrders(Array.isArray(d) ? d : d?.orders || d?.data || []);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [token]);

  const kpiStats = useMemo(() => {
    const totalBudget = projects.reduce((acc: number, p: any) => acc + (p.budget || 0), 0);
    const totalSpent = projects.reduce((acc: number, p: any) => acc + (p.spent || 0), 0);
    const activeCount = projects.filter((p: any) => p.status === 'active').length;
    const estimatedRevenue = totalBudget * 1.2;
    const margin = totalBudget > 0 ? (((estimatedRevenue - totalSpent) / estimatedRevenue) * 100).toFixed(1) : '0';

    return [
      {
        title: 'Total Budget',
        value: `$${(totalBudget / 1000).toFixed(1)}K`,
        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
      },
      {
        title: 'Actual Spent',
        value: `$${(totalSpent / 1000).toFixed(1)}K`,
        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
      },
      {
        title: 'Active Projects',
        value: activeCount.toString(),
        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
      },
      {
        title: 'Est. Margin',
        value: `${margin}%`,
        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
        color: parseFloat(margin) > 20 ? 'text-green-600' : 'text-yellow-600',
        bg: parseFloat(margin) > 20 ? 'bg-green-50' : 'bg-yellow-50',
      },
    ];
  }, [projects]);

  const signageOrdersStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ordersToday = orders.filter((o: any) => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    return {
      ordersToday: ordersToday.length,
      revenueToday: ordersToday.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0),
      outstanding: orders.filter((o: any) => !o.paid).reduce((sum: number, o: any) => sum + (o.totalAmount || 0) - (o.amountPaid || 0), 0),
      totalOrders: orders.length,
      statusCounts: {
        pending: orders.filter((o: any) => o.status === 'pending_approval' || o.status === 'pending').length,
        printing: orders.filter((o: any) => o.status === 'printing').length,
        completed: orders.filter((o: any) => o.status === 'delivered' || o.status === 'completed').length,
      },
    };
  }, [orders]);

  return (
    <>
      <CEOKpiStats kpiStats={kpiStats} />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CEOProjectsTable projects={projects} />
        </div>
        <div className="space-y-6">
          <CEOSignageOrdersWidget stats={signageOrdersStats} onViewAll={() => navigate('/dashboard/orders')} />
        </div>
      </div>
    </>
  );
}

function EmployeeOverview() {
  const { profile } = useDashboardContext();
  const { projects, tasks, fetchProjects, fetchTasks } = useOperationalData(profile.userId, 'employee');

  useEffect(() => {
    fetchProjects();
    fetchTasks();
  }, []);

  const stats = [
    { title: 'My Projects', value: projects.length },
    { title: 'My Tasks', value: tasks.length },
    { title: 'In Progress', value: tasks.filter((t) => t.status === 'in_progress' || t.status === 'active').length },
    { title: 'Completed', value: tasks.filter((t) => t.status === 'done' || t.status === 'completed').length },
  ];

  return <ProfileStats stats={stats} />;
}

function CustomerOverview() {
  const { profile } = useDashboardContext();
  const { projects, fetchProjects } = useOperationalData(profile.userId, 'customer');
  const { tickets, fetchTickets } = useTickets(profile.userId, 'customer');

  useEffect(() => {
    fetchProjects();
    fetchTickets();
  }, []);

  const stats = [
    { title: 'My Projects', value: projects.length },
    { title: 'Open Tickets', value: tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length },
    { title: 'Total Tickets', value: tickets.length },
  ];

  return <ProfileStats stats={stats} />;
}

export default function OverviewPage() {
  const { profile } = useDashboardContext();

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader
        title="Overview"
        description={`${profile.profileType.charAt(0).toUpperCase() + profile.profileType.slice(1)} dashboard`}
      />
      <div className="flex-1 overflow-y-auto p-6">
        {profile.profileType === 'ceo' && <CEOOverview />}
        {profile.profileType === 'employee' && <EmployeeOverview />}
        {profile.profileType === 'customer' && <CustomerOverview />}
      </div>
    </div>
  );
}
