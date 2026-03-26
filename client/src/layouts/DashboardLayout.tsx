import { useState } from 'react';
import { Outlet, useOutletContext, Navigate } from 'react-router-dom';
import { Spinner } from '@librechat/client';
import useProfile from '~/hooks/useProfile';
import DashboardSidebar from '~/components/Dashboard/DashboardSidebar';
import type { ProfileData } from '~/components/Profile';
import { SocialDraftModal } from '~/components/SocialDraft';

interface DashboardContext {
  profile: ProfileData;
}

export function useDashboardContext() {
  return useOutletContext<DashboardContext>();
}

export default function DashboardLayout() {
  const { profile, isLoading, error } = useProfile();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-primary">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-primary">
        <div className="max-w-md rounded-lg border border-border-light bg-surface-primary-alt p-8 text-center">
          <h3 className="text-lg font-semibold text-text-primary">
            {error ? 'Error Loading Profile' : 'No Profile Found'}
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            {error || 'Your account does not have a profile configured. Contact your administrator.'}
          </p>
          <a
            href="/c/new"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Chat
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface-primary">
      <DashboardSidebar
        profile={profile}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
      />
      <main className="flex-1 overflow-y-auto">
        <Outlet context={{ profile } satisfies DashboardContext} />
      </main>
      {import.meta.env.VITE_SOCIAL_MEDIA_AUTOMATION === 'true' && <SocialDraftModal />}
    </div>
  );
}
