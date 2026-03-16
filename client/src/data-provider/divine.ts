export interface DivineMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export interface DivineChatEvent {
  type: 'chunk' | 'done' | 'error';
  content: string;
}

/**
 * Stream a message to Divine Intelligence.
 * Returns an AbortController you can call .abort() on to cancel.
 */
export function sendDivineMessage(
  message: string,
  onChunk: (chunk: string) => void,
  onDone: (fullResponse: string) => void,
  onError: (error: string) => void,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch('/api/divine/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        onError(err.error || 'Request failed');
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const event: DivineChatEvent = JSON.parse(line.slice(6));
            if (event.type === 'chunk') onChunk(event.content);
            else if (event.type === 'done') onDone(event.content);
            else if (event.type === 'error') onError(event.content);
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') onError(err?.message ?? 'Unknown error');
    }
  })();

  return controller;
}

export async function getDivineHistory(): Promise<DivineMessage[]> {
  const res = await fetch('/api/divine/history', { credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.history ?? [];
}

export async function clearDivineHistory(): Promise<void> {
  await fetch('/api/divine/history', { method: 'DELETE', credentials: 'include' });
}

// ── Events (autonomous action log) ──────────────────────────────────────────

export interface DivinEvent {
  _id: string;
  trigger: string;
  prompt?: string;
  response?: string;
  success: boolean;
  error?: string;
  duration?: number;
  createdAt: string;
}

export interface DivinEventStats {
  total: number;
  last24h: number;
  failures: number;
  latest?: { trigger: string; createdAt: string; success: boolean };
}

export async function getDivineEvents(params?: {
  limit?: number;
  page?: number;
  success?: boolean;
}): Promise<{ events: DivinEvent[]; total: number; page: number; limit: number }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.page) query.set('page', String(params.page));
  if (params?.success !== undefined) query.set('success', String(params.success));

  const res = await fetch(`/api/divine/events?${query}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load events');
  return res.json();
}

export async function getDivineEventStats(): Promise<DivinEventStats> {
  const res = await fetch('/api/divine/events/stats', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load event stats');
  return res.json();
}

// ── Notifications ────────────────────────────────────────────────────────────

export interface DivineNotification {
  _id: string;
  message: string;
  refType?: string;
  refId?: string;
  read: boolean;
  createdAt: string;
}

export async function getDivineNotifications(unreadOnly?: boolean): Promise<{
  notifications: DivineNotification[];
  unreadCount: number;
}> {
  const query = unreadOnly ? '?unreadOnly=true' : '';
  const res = await fetch(`/api/divine/notifications${query}`, { credentials: 'include' });
  if (!res.ok) return { notifications: [], unreadCount: 0 };
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch(`/api/divine/notifications/${id}/read`, {
    method: 'PATCH',
    credentials: 'include',
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetch('/api/divine/notifications/read-all', {
    method: 'PATCH',
    credentials: 'include',
  });
}
