import { useState, useEffect } from 'react';
import DashboardHeader from '~/components/Dashboard/DashboardHeader';
import { useDashboardContext } from '~/layouts/DashboardLayout';
import EmployeeTasksTab from '~/components/Profile/Employee/EmployeeTasksTab';
import { useOperationalData } from '~/hooks/useOperationalData';

const n8nBaseUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://nadyaputriast-n8n.hf.space';

function CEOTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${n8nBaseUrl}/webhook/librechat/task-management`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((d) => setTasks(d?.tasks || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-text-secondary">
        <p>No tasks found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border-light bg-surface-primary-alt shadow-sm">
      <table className="min-w-full divide-y divide-border-light">
        <thead className="bg-surface-tertiary">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Task</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Priority</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Assigned To</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Due Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {tasks.map((task: any, idx: number) => (
            <tr key={task._id || task.id || idx} className="hover:bg-surface-hover">
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-text-primary">{task.title}</div>
                {task.description && <div className="text-sm text-text-secondary">{task.description}</div>}
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex rounded-full px-2 text-xs font-semibold capitalize leading-5">
                  {task.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-text-secondary capitalize">{task.priority || '-'}</td>
              <td className="px-6 py-4 text-sm text-text-secondary">{task.assignedTo || task.assignedToName || '-'}</td>
              <td className="px-6 py-4 text-sm text-text-secondary">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TasksPage() {
  const { profile } = useDashboardContext();
  const opData = useOperationalData(profile.userId, profile.profileType);

  useEffect(() => {
    if (profile.profileType === 'employee') {
      opData.fetchTasks();
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Tasks" />
      <div className="flex-1 overflow-y-auto p-6">
        {profile.profileType === 'ceo' && <CEOTasks />}
        {profile.profileType === 'employee' && (
          <EmployeeTasksTab
            tasks={opData.tasks}
            employees={opData.employees}
            fetchTasks={opData.fetchTasks}
            crudTask={opData.crudTask}
            isSubmitting={opData.isSubmitting}
            loading={opData.loading}
          />
        )}
      </div>
    </div>
  );
}
