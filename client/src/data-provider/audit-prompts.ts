import { request } from 'librechat-data-provider';

export interface AuditPrompt {
  _id: string;
  key: string;
  version: number;
  name: string;
  content: string;
  description: string;
  category: string;
  isLatest: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditPromptsListResponse {
  prompts: AuditPrompt[];
  categories: string[];
  total: number;
}

export interface AuditPromptVersionsResponse {
  versions: AuditPrompt[];
}

const BASE = '/api/audit-prompts';

export async function listAuditPrompts(params?: {
  category?: string;
  includeInactive?: boolean;
}): Promise<AuditPromptsListResponse> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.includeInactive) query.set('includeInactive', 'true');
  const qs = query.toString();
  return request.get<AuditPromptsListResponse>(qs ? `${BASE}?${qs}` : BASE);
}

export async function getAuditPrompt(key: string): Promise<AuditPrompt> {
  return request.get<AuditPrompt>(`${BASE}/${key}`);
}

export async function getAuditPromptVersions(key: string): Promise<AuditPromptVersionsResponse> {
  return request.get<AuditPromptVersionsResponse>(`${BASE}/${key}/versions`);
}

export async function createAuditPrompt(data: {
  key: string;
  name: string;
  content: string;
  description?: string;
  category?: string;
}): Promise<AuditPrompt> {
  return request.post(BASE, data) as Promise<AuditPrompt>;
}

export async function updateAuditPrompt(
  key: string,
  data: {
    name?: string;
    content: string;
    description?: string;
    category?: string;
  },
): Promise<AuditPrompt> {
  return request.put(`${BASE}/${key}`, data) as Promise<AuditPrompt>;
}

export async function toggleAuditPrompt(key: string): Promise<{ key: string; isActive: boolean }> {
  return request.patch(`${BASE}/${key}/toggle`, {}) as Promise<{ key: string; isActive: boolean }>;
}

export async function deleteAuditPrompt(key: string): Promise<{ deleted: number }> {
  return request.delete(`${BASE}/${key}`) as Promise<{ deleted: number }>;
}

// ── Capabilities (singleton JSON) ──

export interface JamotCapability {
  _id?: string;
  data: Record<string, unknown>;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function getCapabilities(): Promise<JamotCapability> {
  return request.get<JamotCapability>(`${BASE}/capabilities`);
}

export async function updateCapabilities(data: Record<string, unknown>): Promise<JamotCapability> {
  return request.put(`${BASE}/capabilities`, { data }) as Promise<JamotCapability>;
}
