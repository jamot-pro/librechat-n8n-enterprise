import { useState, useEffect } from 'react';
import DashboardHeader from '~/components/Dashboard/DashboardHeader';
import { useDashboardContext } from '~/layouts/DashboardLayout';
import CEOProjectsTable from '~/components/Profile/CEO/CEOProjectsTable';
import EmployeeProjectsTab from '~/components/Profile/Employee/EmployeeProjectsTab';
import CustomerProjectsTab from '~/components/Profile/Customer/CustomerProjectsTab';
import { useOperationalData } from '~/hooks/useOperationalData';

const n8nBaseUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://nadyaputriast-n8n.hf.space';

function CEOProjects() {
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${n8nBaseUrl}/webhook/librechat/project-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileType: 'ceo', action: 'list' }),
    })
      .then((r) => r.json())
      .then((d) => setProjects(d?.data?.projects || (Array.isArray(d) ? d : d?.data || [])))
      .catch(console.error);
  }, []);

  return <CEOProjectsTable projects={projects} />;
}

export default function ProjectsPage() {
  const { profile } = useDashboardContext();
  const opData = useOperationalData(profile.userId, profile.profileType);

  useEffect(() => {
    if (profile.profileType !== 'ceo') {
      opData.fetchProjects();
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Projects" />
      <div className="flex-1 overflow-y-auto p-6">
        {profile.profileType === 'ceo' && <CEOProjects />}
        {profile.profileType === 'employee' && (
          <EmployeeProjectsTab
            projects={opData.projects}
            tasks={opData.tasks}
            employees={opData.employees}
            fetchProjects={opData.fetchProjects}
            fetchTasks={opData.fetchTasks}
            crudProject={opData.crudProject}
            crudTask={opData.crudTask}
            isSubmitting={opData.isSubmitting}
            loading={opData.loading}
          />
        )}
        {profile.profileType === 'customer' && (
          <CustomerProjectsTab
            projects={opData.projects}
            fetchProjects={opData.fetchProjects}
            crudProject={opData.crudProject}
            isSubmitting={opData.isSubmitting}
            loading={opData.loading}
          />
        )}
      </div>
    </div>
  );
}
