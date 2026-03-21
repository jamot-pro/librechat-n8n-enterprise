import { useState, useCallback, useEffect } from 'react';
import { useToastContext } from '@librechat/client';
import { useAuthContext } from '~/hooks';

export interface BoardColumn {
  _id: string;
  label: string;
  order: number;
}

export function useHiringColumns() {
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuthContext();
  const { showToast } = useToastContext();

  const refetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/hiring/columns', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) setColumns(data);
      else showToast({ message: data.error || 'Failed to load columns', status: 'error' });
    } catch {
      showToast({ message: 'Failed to load columns', status: 'error' });
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => { refetch(); }, [refetch]);

  const createColumn = useCallback(
    async (label: string): Promise<BoardColumn> => {
      const res = await fetch('/api/hiring/columns', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ message: data.error || 'Failed to create column', status: 'error' });
        throw new Error(data.error);
      }
      setColumns((prev) => [...prev, data]);
      return data;
    },
    [token, showToast],
  );

  const updateColumn = useCallback(
    async (id: string, patch: { label?: string; order?: number }) => {
      const body: Record<string, unknown> = {};
      if (patch.label !== undefined) {
        const label = patch.label.trim();
        if (!label) {
          showToast({ message: 'Column name cannot be empty', status: 'error' });
          throw new Error('Empty label');
        }
        body.label = label;
      }
      if (patch.order !== undefined) body.order = patch.order;

      const res = await fetch(`/api/hiring/columns/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ message: data.error || 'Failed to update column', status: 'error' });
        throw new Error(data.error);
      }
      setColumns((prev) => prev.map((c) => (c._id === id ? data : c)));
      return data as BoardColumn;
    },
    [token, showToast],
  );

  const deleteColumn = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/hiring/columns/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        showToast({ message: data.error || 'Failed to delete column', status: 'error' });
        return;
      }
      setColumns((prev) => prev.filter((c) => c._id !== id));
    },
    [token, showToast],
  );

  return { columns, loading, createColumn, updateColumn, deleteColumn, refetch };
}
