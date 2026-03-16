import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDivineHistory,
  clearDivineHistory,
  getDivineEvents,
  getDivineEventStats,
  getDivineNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './divine';

export const divineKeys = {
  history: () => ['divine', 'history'] as const,
  events: (params?: object) => ['divine', 'events', params] as const,
  eventStats: () => ['divine', 'events', 'stats'] as const,
  notifications: (unreadOnly?: boolean) => ['divine', 'notifications', unreadOnly] as const,
};

export function useDivineHistory() {
  return useQuery({
    queryKey: divineKeys.history(),
    queryFn: getDivineHistory,
    staleTime: 0,
  });
}

export function useClearDivineHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearDivineHistory,
    onSuccess: () => qc.setQueryData(divineKeys.history(), []),
  });
}

export function useDivineEvents(params?: { limit?: number; page?: number; success?: boolean }) {
  return useQuery({
    queryKey: divineKeys.events(params),
    queryFn: () => getDivineEvents(params),
    staleTime: 30_000,
  });
}

export function useDivineEventStats() {
  return useQuery({
    queryKey: divineKeys.eventStats(),
    queryFn: getDivineEventStats,
    refetchInterval: 60_000,
  });
}

export function useDivineNotifications(unreadOnly?: boolean) {
  return useQuery({
    queryKey: divineKeys.notifications(unreadOnly),
    queryFn: () => getDivineNotifications(unreadOnly),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['divine', 'notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['divine', 'notifications'] }),
  });
}
