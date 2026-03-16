# Frontend — UI Components

## Overview

The frontend adds two main surfaces:
1. **Task Board** — standalone page accessible to all roles (filtered by role)
2. **Divine Chat** — floating sidebar available on any page, the main interface to Divine Intelligence

Both are wired with React Query for data fetching and optimistic updates.

---

## 1. Task Components

### TaskBoard Page

**File:** `client/src/components/Tasks/TaskBoard.tsx`

```tsx
import React, { useState } from 'react';
import { useTaskList, useTaskStats } from '~/data-provider/task-queries';
import TaskCard from './TaskCard';
import TaskCreateModal from './TaskCreateModal';
import TaskFilters from './TaskFilters';

type Status = 'todo' | 'in_progress' | 'review' | 'done';
const COLUMNS: { key: Status; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

export default function TaskBoard() {
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ priority: '', assignedTo: '' });

  const { data: stats } = useTaskStats();
  const { data: tasks = [], isLoading } = useTaskList(filters);

  const byStatus = (status: Status) => tasks.filter((t) => t.status === status);

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tasks</h1>
          {stats && (
            <p className="text-sm text-gray-500">
              {stats.total} total · {stats.overdue} overdue
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          + New Task
        </button>
      </div>

      {/* Filters */}
      <TaskFilters filters={filters} onChange={setFilters} />

      {/* Kanban Columns */}
      <div className="grid grid-cols-4 gap-4 flex-1 overflow-hidden">
        {COLUMNS.map((col) => (
          <div key={col.key} className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{col.label}</span>
              <span className="text-xs bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">
                {byStatus(col.key).length}
              </span>
            </div>
            {isLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />)}
              </div>
            ) : (
              byStatus(col.key).map((task) => <TaskCard key={task._id} task={task} />)
            )}
          </div>
        ))}
      </div>

      {showCreate && <TaskCreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
```

---

### TaskCard

**File:** `client/src/components/Tasks/TaskCard.tsx`

```tsx
import React, { useState } from 'react';
import { useUpdateTaskStatus } from '~/data-provider/task-queries';

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function TaskCard({ task }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateStatus = useUpdateTaskStatus();

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  return (
    <div
      className={`bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm cursor-pointer border-l-4 ${
        isOverdue ? 'border-red-500' : 'border-transparent'
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2">
          {task.title}
        </p>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      {task.assignedToName && (
        <p className="text-xs text-gray-500 mt-1">→ {task.assignedToName}</p>
      )}

      {task.dueDate && (
        <p className={`text-xs mt-1 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
          Due {new Date(task.dueDate).toLocaleDateString()}
          {isOverdue && ' · Overdue'}
        </p>
      )}

      {task.source !== 'manual' && (
        <span className="text-xs text-gray-400 italic">via {task.source.replace('_', ' ')}</span>
      )}

      {/* Quick status change */}
      {isExpanded && (
        <div className="mt-2 flex gap-1 flex-wrap">
          {['todo', 'in_progress', 'review', 'done'].map((s) => (
            <button
              key={s}
              disabled={task.status === s}
              onClick={(e) => {
                e.stopPropagation();
                updateStatus.mutate({ taskId: task._id, status: s });
              }}
              className={`text-xs px-2 py-0.5 rounded-full border ${
                task.status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'text-gray-500 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### TaskCreateModal

**File:** `client/src/components/Tasks/TaskCreateModal.tsx`

```tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { useCreateTask } from '~/data-provider/task-queries';

export default function TaskCreateModal({ onClose, prefill = {} }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { priority: 'medium', ...prefill },
  });
  const createTask = useCreateTask();

  const onSubmit = (data) => {
    createTask.mutate(data, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Create Task</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title *</label>
            <input
              {...register('title', { required: 'Title is required' })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
              placeholder="e.g. Review Q1 audit report"
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
              placeholder="What needs to be done..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Assign To</label>
              <input
                {...register('assignedToName')}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                placeholder="Name (optional)"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <select
                {...register('priority')}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Due Date</label>
            <input
              type="date"
              {...register('dueDate')}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTask.isLoading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createTask.isLoading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## 2. Divine Chat Component

**File:** `client/src/components/Divine/DivineChat.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { sendDivineMessage } from '~/data-provider/divine';
import { useDivineHistory } from '~/data-provider/divine-queries';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export default function DivineChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: history } = useDivineHistory();

  // Load history on mount
  useEffect(() => {
    if (history?.length) {
      setMessages(history.map((m) => ({ role: m.role, content: m.content })));
    }
  }, [history]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // Add streaming assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    abortRef.current = sendDivineMessage(
      userMessage,
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.isStreaming) {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      },
      (fullResponse) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.isStreaming) {
            updated[updated.length - 1] = { role: 'assistant', content: fullResponse };
          }
          return updated;
        });
        setIsLoading(false);
      },
      (error) => {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: `Error: ${error}` },
        ]);
        setIsLoading(false);
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="font-semibold text-sm">Divine Intelligence</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p className="text-2xl mb-2">✦</p>
            <p>Ask me anything or tell me what to do.</p>
            <p className="mt-1 text-xs">e.g. "Create a task for Andrea to review the Q1 audit"</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5" />}
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t dark:border-gray-700">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
            placeholder="Ask or instruct..."
            className="flex-1 px-3 py-2 text-sm border rounded-xl resize-none dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {isLoading ? '...' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 3. Divine Sidebar Wrapper

**File:** `client/src/components/Divine/DivineSidebar.tsx`

```tsx
import React, { useState } from 'react';
import DivineChat from './DivineChat';

export default function DivineSidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 z-40 text-lg"
        title="Divine Intelligence"
      >
        ✦
      </button>

      {/* Slide-in panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="flex-1" onClick={() => setIsOpen(false)} />
          {/* Panel */}
          <div className="w-96 bg-white dark:bg-gray-900 shadow-2xl flex flex-col h-full border-l dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
              <span className="font-bold">✦ Divine Intelligence</span>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DivineChat />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Add `<DivineSidebar />` to the root layout (`client/src/routes/Root.tsx`) so it's available everywhere.**

---

## 4. Task React Query Hooks

**File:** `client/src/data-provider/task-queries.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = '/api/tasks';

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

export const taskKeys = {
  all: () => ['tasks'] as const,
  list: (filters: object) => ['tasks', 'list', filters] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  stats: () => ['tasks', 'stats'] as const,
};

export function useTaskList(filters = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => fetchJSON(`${API}?${params}`).then((d) => d.tasks),
  });
}

export function useTaskStats() {
  return useQuery({
    queryKey: taskKeys.stats(),
    queryFn: () => fetchJSON(`${API}/stats`),
    refetchInterval: 60_000, // refresh every minute
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => fetchJSON(API, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all() }),
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      fetchJSON(`${API}/${taskId}`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onMutate: async ({ taskId, status }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: taskKeys.all() });
      const prev = qc.getQueriesData({ queryKey: taskKeys.all() });
      qc.setQueriesData({ queryKey: taskKeys.all() }, (old: any) =>
        old?.tasks
          ? { ...old, tasks: old.tasks.map((t: any) => t._id === taskId ? { ...t, status } : t) }
          : old
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      ctx?.prev?.forEach(([key, val]) => qc.setQueryData(key, val));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all() }),
  });
}

export function useAssignTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, assignedTo }: { taskId: string; assignedTo: string }) =>
      fetchJSON(`${API}/${taskId}/assign`, { method: 'PATCH', body: JSON.stringify({ assignedTo }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all() }),
  });
}
```

---

## 5. Navigation Integration

Add Tasks to the sidebar navigation.

**In `client/src/components/Nav/` (wherever the nav links live), add:**
```tsx
<NavLink to="/tasks" icon={<CheckSquare size={18} />}>
  Tasks
  {stats?.overdue > 0 && (
    <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">
      {stats.overdue}
    </span>
  )}
</NavLink>
```

**Add route in `client/src/App.jsx`:**
```jsx
import TaskBoard from '~/components/Tasks/TaskBoard';
// ...
<Route path="/tasks" element={<TaskBoard />} />
```

---

## 6. Dashboard Task Widget

Add a compact task summary to CEO/Employee dashboards.

**File:** `client/src/components/Tasks/TaskDashboardWidget.tsx`

```tsx
export default function TaskDashboardWidget() {
  const { data: stats } = useTaskStats();
  const { data: tasks = [] } = useTaskList({ status: 'todo', limit: 5 });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Tasks</h3>
        {stats?.overdue > 0 && (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
            {stats.overdue} overdue
          </span>
        )}
      </div>
      <div className="space-y-2">
        {tasks.slice(0, 5).map((t) => (
          <div key={t._id} className="flex items-center gap-2 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="truncate text-gray-700 dark:text-gray-300">{t.title}</span>
            {t.assignedToName && <span className="text-xs text-gray-400 ml-auto shrink-0">{t.assignedToName}</span>}
          </div>
        ))}
      </div>
      <a href="/tasks" className="text-xs text-blue-500 mt-3 block hover:underline">
        View all →
      </a>
    </div>
  );
}
```
