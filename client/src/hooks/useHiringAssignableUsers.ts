import { useState, useCallback, useEffect } from 'react';
import { useAuthContext } from '~/hooks';
import type { AssignableUser } from '~/components/HiringPanel/types';

export function useHiringAssignableUsers() {
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuthContext();

  const refetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/hiring/assignable-users', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { assignableUsers: users, loadingAssignableUsers: loading, refetchAssignableUsers: refetch };
}
