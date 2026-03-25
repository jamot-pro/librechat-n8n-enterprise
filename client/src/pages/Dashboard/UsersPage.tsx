import DashboardHeader from '~/components/Dashboard/DashboardHeader';
import CEOUserManagement from '~/components/Profile/CEO/CEOUserManagement';
import { useDashboardContext } from '~/layouts/DashboardLayout';

export default function UsersPage() {
  const { profile } = useDashboardContext();

  if (profile.profileType !== 'ceo') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-secondary">Access restricted to CEO.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="User Management" />
      <div className="flex-1 overflow-y-auto p-6">
        <CEOUserManagement />
      </div>
    </div>
  );
}
