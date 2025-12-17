import { useState, useEffect } from 'react';
import { useAuthContext } from '~/hooks/AuthContext';
import type { ProfileData } from '~/components/Profile';

interface UseProfileResult {
  profile: ProfileData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user profile data
 * Integrates with the backend /api/profile endpoint
 */
export default function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, isAuthenticated } = useAuthContext();

  const fetchProfile = async () => {
    if (!isAuthenticated || !token) {
      setError('Not authenticated');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useProfile] Fetching profile from /api/profile...');
      const response = await fetch('/api/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for authentication
      });
      console.log('[useProfile] Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please log in again.');
        } else if (response.status === 404) {
          throw new Error('Profile not found. Please contact your administrator.');
        } else {
          throw new Error(`Failed to fetch profile: ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('[useProfile] Profile data received:', data);
      // Validate profile data structure
      if (!data || !data.profileType) {
        throw new Error('Invalid profile data received from server.');
      }

      setProfile(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('[useProfile] Error fetching profile:', err);
      setError(errorMessage);
      console.error('Error fetching profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchProfile();
    }
  }, [isAuthenticated, token]);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile,
  };
}
