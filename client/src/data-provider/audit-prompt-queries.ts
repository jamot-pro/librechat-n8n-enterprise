import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAuditPrompts,
  getAuditPrompt,
  getAuditPromptVersions,
  createAuditPrompt,
  updateAuditPrompt,
  toggleAuditPrompt,
  deleteAuditPrompt,
  getCapabilities,
  updateCapabilities,
} from './audit-prompts';

export const auditPromptKeys = {
  all: () => ['audit-prompts'] as const,
  list: (params?: object) => ['audit-prompts', 'list', params] as const,
  detail: (key: string) => ['audit-prompts', 'detail', key] as const,
  versions: (key: string) => ['audit-prompts', 'versions', key] as const,
};

export function useAuditPromptList(params?: { category?: string; includeInactive?: boolean }) {
  return useQuery({
    queryKey: auditPromptKeys.list(params),
    queryFn: () => listAuditPrompts(params),
    staleTime: 30_000,
  });
}

export function useAuditPrompt(key: string) {
  return useQuery({
    queryKey: auditPromptKeys.detail(key),
    queryFn: () => getAuditPrompt(key),
    enabled: !!key,
  });
}

export function useAuditPromptVersions(key: string) {
  return useQuery({
    queryKey: auditPromptKeys.versions(key),
    queryFn: () => getAuditPromptVersions(key),
    enabled: !!key,
  });
}

export function useCreateAuditPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAuditPrompt,
    onSuccess: () => qc.invalidateQueries({ queryKey: auditPromptKeys.all() }),
  });
}

export function useUpdateAuditPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...data }: { key: string; name?: string; content: string; description?: string; category?: string }) =>
      updateAuditPrompt(key, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: auditPromptKeys.all() }),
  });
}

export function useToggleAuditPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleAuditPrompt,
    onSuccess: () => qc.invalidateQueries({ queryKey: auditPromptKeys.all() }),
  });
}

export function useDeleteAuditPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAuditPrompt,
    onSuccess: () => qc.invalidateQueries({ queryKey: auditPromptKeys.all() }),
  });
}

// ── Capabilities ──

export function useCapabilities() {
  return useQuery({
    queryKey: ['jamot-capabilities'] as const,
    queryFn: getCapabilities,
    staleTime: 60_000,
  });
}

export function useUpdateCapabilities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => updateCapabilities(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jamot-capabilities'] }),
  });
}
