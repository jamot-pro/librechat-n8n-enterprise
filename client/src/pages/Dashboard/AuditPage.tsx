import DashboardHeader from '~/components/Dashboard/DashboardHeader';
import { AuditManagementPage } from '~/components/Audit';
import { useDashboardContext } from '~/layouts/DashboardLayout';
import { useFeatureFlag } from '~/hooks/useFeatureFlag';
import { FEATURES } from '~/constants/businesses';

export default function AuditPage() {
  const { profile } = useDashboardContext();
  const { isEnabled } = useFeatureFlag(FEATURES.AUDIT);

  if (profile.profileType !== 'ceo') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-secondary">Access restricted to CEO.</p>
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-secondary">Audit feature is not enabled for this business.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Audit Management" />
      <div className="flex-1 overflow-y-auto p-6">
        <AuditManagementPage />
      </div>
    </div>
  );
}
