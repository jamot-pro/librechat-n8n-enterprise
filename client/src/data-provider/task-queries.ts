import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTaskBoard,
  getTaskStats,
  listTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  assignTask,
  addComment,
  deleteTask,
  type Task,
  type CreateTaskInput,
  type UpdateTaskInput,
} from './tasks';

export const taskKeys = {
  all: ['tasks'] as const,
  board: () => [...taskKeys.all, 'board'] as const,
  stats: () => [...taskKeys.all, 'stats'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (params: object) => [...taskKeys.lists(), params] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};

export function useTaskBoard() {
  return useQuery({
    queryKey: taskKeys.board(),
    queryFn: getTaskBoard,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useTaskStats() {
  return useQuery({
    queryKey: taskKeys.stats(),
    queryFn: getTaskStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useTaskList(params?: Parameters<typeof listTasks>[0]) {
  return useQuery({
    queryKey: taskKeys.list(params ?? {}),
    queryFn: () => listTasks(params),
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => getTask(taskId),
    enabled: !!taskId,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskInput) => createTask(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskInput }) =>
      updateTask(taskId, data),
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: taskKeys.board() });
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: Task['status'] }) =>
      updateTaskStatus(taskId, status),
    // Optimistic update on the board
    onMutate: async ({ taskId, status }) => {
      await qc.cancelQueries({ queryKey: taskKeys.board() });
      const prev = qc.getQueryData(taskKeys.board());

      qc.setQueryData(taskKeys.board(), (old: any) => {
        if (!old) return old;
        const updated = { ...old };
        // Remove from all columns
        const allStatuses = ['todo', 'in_progress', 'review', 'done'] as const;
        let movedTask: Task | null = null;
        for (const s of allStatuses) {
          const idx = updated[s]?.findIndex((t: Task) => t._id === taskId);
          if (idx !== undefined && idx >= 0) {
            movedTask = { ...updated[s][idx], status };
            updated[s] = updated[s].filter((t: Task) => t._id !== taskId);
            break;
          }
        }
        // Add to new column
        if (movedTask && updated[status as keyof typeof updated]) {
          updated[status as keyof typeof updated] = [
            movedTask,
            ...(updated[status as keyof typeof updated] as Task[]),
          ];
        }
        return updated;
      });

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(taskKeys.board(), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: taskKeys.board() });
      qc.invalidateQueries({ queryKey: taskKeys.stats() });
    },
  });
}

export function useAssignTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      assignedToId,
      assignedToName,
    }: {
      taskId: string;
      assignedToId: string;
      assignedToName?: string;
    }) => assignTask(taskId, assignedToId, assignedToName),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, text }: { taskId: string; text: string }) => addComment(taskId, text),
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.board() });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}
