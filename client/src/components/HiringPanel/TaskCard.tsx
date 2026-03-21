import React from 'react';
import { User } from 'lucide-react';
import type { Task, AssignableUser } from './types';
import { formatPriorityLabel, priorityBadgeClass } from './priorityStyles';

interface TaskCardProps {
  task: Task;
  assignableUsers?: AssignableUser[];
  onStatusChange: (id: string, data: Partial<Task>) => void;
  onClick?: () => void;
}

export default function TaskCard({
  task,
  assignableUsers = [],
  onStatusChange: _onStatusChange,
  onClick,
}: TaskCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', task._id);
  };

  const assigneeLabel = task.assignee
    ? assignableUsers.find((u) => u.id === task.assignee)?.label || 'Assigned'
    : '';

  const accentColor = 'bg-gray-300 dark:bg-gray-600';

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md active:cursor-grabbing dark:border-gray-700 dark:bg-gray-800"
    >
      <div className={`mb-2 h-1 w-8 rounded-full ${accentColor}`} />
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{task.title}</p>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
          {task.description}
        </p>
      )}
      {(task.labels?.length || task.priority || task.dueDate || assigneeLabel) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {assigneeLabel && (
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              <User className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{assigneeLabel}</span>
            </span>
          )}
          {task.priority && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(task.priority)}`}
            >
              {formatPriorityLabel(task.priority)}
            </span>
          )}
          {task.dueDate && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
          {task.labels?.slice(0, 2).map((l) => (
            <span
              key={l}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
