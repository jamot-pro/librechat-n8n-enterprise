/**
 * Task Management API Client
 */
import { request } from 'librechat-data-provider';

const BASE = '/api/tasks';

export interface TaskComment {
  _id: string;
  userId: string | { _id: string; name: string; username: string; avatar?: string };
  userName: string;
  text: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  createdBy: string | { _id: string; name: string; username: string };
  createdByName: string;
  assignedTo: string | { _id: string; name: string; username: string; avatar?: string } | null;
  assignedToName: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string | null;
  source: 'manual' | 'divine_chat' | 'divine_autonomous' | 'audit' | 'signage' | 'social';
  sourceRef: string | null;
  tags: string[];
  comments: TaskComment[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanBoard {
  todo: Task[];
  in_progress: Task[];
  review: Task[];
  done: Task[];
}

export interface TaskStats {
  total: number;
  byStatus: { _id: string; count: number }[];
  overdue: number;
  byPriority: { _id: string; count: number }[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignedToName?: string;
  assignedToId?: string;
  priority?: Task['priority'];
  dueDate?: string;
  tags?: string[];
  sourceRef?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  dueDate?: string | null;
  tags?: string[];
}

export interface UserSearchResult {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
}

export const getTaskBoard = (): Promise<KanbanBoard> => request.get(BASE + '/board');

export const getTaskStats = (): Promise<TaskStats> => request.get(BASE + '/stats');

export const listTasks = (params?: {
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ tasks: Task[]; total: number; page: number; limit: number }> => {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.priority) qs.set('priority', params.priority);
  if (params?.search) qs.set('search', params.search);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return request.get(query ? `${BASE}?${query}` : BASE);
};

export const getTask = (taskId: string): Promise<Task> => request.get(`${BASE}/${taskId}`);

export const createTask = (data: CreateTaskInput): Promise<Task> =>
  request.post(BASE, data) as Promise<Task>;

export const updateTask = (taskId: string, data: UpdateTaskInput): Promise<Task> =>
  request.put(`${BASE}/${taskId}`, data) as Promise<Task>;

export const updateTaskStatus = (taskId: string, status: Task['status']): Promise<Task> =>
  request.patch(`${BASE}/${taskId}/status`, { status }) as Promise<Task>;

export const assignTask = (taskId: string, assignedToId: string, assignedToName?: string): Promise<Task> =>
  request.patch(`${BASE}/${taskId}/assign`, { assignedToId, assignedToName }) as Promise<Task>;

export const addComment = (taskId: string, text: string): Promise<Task> =>
  request.post(`${BASE}/${taskId}/comments`, { text }) as Promise<Task>;

export const deleteTask = (taskId: string): Promise<{ success: boolean }> =>
  request.delete(`${BASE}/${taskId}`) as Promise<{ success: boolean }>;

export const searchUsers = (q: string): Promise<UserSearchResult[]> =>
  request.get(`${BASE}/users?q=${encodeURIComponent(q)}`);
