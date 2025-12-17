import React from 'react';
import { ProfileDashboard } from '~/components/Profile';
import useProfile from '~/hooks/useProfile';

/**
 * Profile Route Component
 * Renders the appropriate profile dashboard based on user's profile type
 */
export default function ProfileRoute() {
  const { profile, isLoading, error } = useProfile();

  return <ProfileDashboard profile={profile} isLoading={isLoading} error={error} />;
}
