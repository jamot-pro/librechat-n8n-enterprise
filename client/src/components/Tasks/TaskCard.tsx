import React from 'react';
import { Calendar, User, MessageSquare, AlertCircle } from 'lucide-react';
import type { Task } from '~/data-provider/tasks';

const PRIORITY_STYLES: Record<Task['priority'], string> = {
  low: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
};

const SOURCE_LABEL: Record<string, string> = {
  divine_chat: 'AI',
  divine_autonomous: 'Auto',
  audit: 'Audit',
  signage: 'Signage',
  social: 'Social',
};

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  isDragging?: boolean;
}

export default function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'done' &&
    task.status !== 'cancelled';

  const dueDateLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const assigneeName =
    task.assignedToName ||
    (typeof task.assignedTo === 'object' && task.assignedTo
      ? task.assignedTo.name || task.assignedTo.username
      : null);

  return (
    <div
      onClick={() => onClick(task)}
      className={`
        group cursor-pointer rounded-lg border bg-white dark:bg-gray-800 p-3
        shadow-sm hover:shadow-md transition-all duration-150 select-none
        ${isDragging ? 'opacity-50 rotate-1 shadow-lg' : ''}
        ${isOverdue ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}
        hover:border-blue-300 dark:hover:border-blue-600
      `}
    >
      {/* Top row: source badge + priority */}
      <div className="flex items-center justify-between mb-2 gap-1">
        <div className="flex items-center gap-1 flex-wrap">
          {task.source !== 'manual' && SOURCE_LABEL[task.source] && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
              {SOURCE_LABEL[task.source]}
            </span>
          )}
          {task.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${PRIORITY_STYLES[task.priority]}`}
        >
          {task.priority}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug line-clamp-2 mb-2">
        {task.title}
      </p>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1 mb-2">
          {task.description}
        </p>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-2">
          {/* Assignee */}
          {assigneeName && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <User size={11} />
              <span className="max-w-[80px] truncate">{assigneeName}</span>
            </div>
          )}
          {/* Comments count */}
          {task.comments?.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <MessageSquare size={11} />
              <span>{task.comments.length}</span>
            </div>
          )}
        </div>

        {/* Due date */}
        {dueDateLabel && (
          <div
            className={`flex items-center gap-1 text-xs ${
              isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {isOverdue && <AlertCircle size={11} />}
            <Calendar size={11} />
            <span>{dueDateLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
