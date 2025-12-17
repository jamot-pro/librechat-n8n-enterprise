import React from 'react';
import CEODashboard from './CEODashboard';
import EmployeeDashboard from './EmployeeDashboard';
import CustomerDashboard from './CustomerDashboard';

export interface ProfileData {
  userId: string;
  profileType: 'ceo' | 'employee' | 'customer';
  permissions: string[];
  allowedWorkflows: Array<{
    workflowId: string;
    workflowName: string;
    endpoint: string;
    description: string;
  }>;
  metadata?: {
    department?: string;
    customerId?: string;
    securityLevel?: number;
    companyId?: string;
  };
}

export interface ProfileDashboardProps {
  profile: ProfileData | null;
  isLoading?: boolean;
  error?: string | null;
}

export default function ProfileDashboard({
  profile,
  isLoading = false,
  error = null,
}: ProfileDashboardProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 animate-spin text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-4 text-sm text-text-secondary">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-red-900">Error Loading Profile</h3>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No profile state
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-border-light bg-surface-primary-alt p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-text-primary">No Profile Found</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Your account doesn't have a profile configured yet. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // Render appropriate dashboard based on profile type
  const renderDashboard = () => {
    switch (profile.profileType) {
      case 'ceo':
        return <CEODashboard profile={profile} />;
      case 'employee':
        return <EmployeeDashboard profile={profile} />;
      case 'customer':
        return <CustomerDashboard profile={profile} />;
      default:
        return (
          <div className="flex min-h-screen items-center justify-center">
            <div className="max-w-md rounded-lg border border-border-light bg-surface-primary-alt p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-text-primary">Unknown Profile Type</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Profile type "{profile.profileType}" is not recognized. Please contact support.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-surface-primary">
      <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {renderDashboard()}
      </div>
    </div>
  );
}
