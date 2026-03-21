import type { TaskPriority } from './types';

/** Pill styles for task cards and priority indicators */
export const PRIORITY_BADGE_CLASSES: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800/90 dark:text-slate-300',
  medium: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  high: 'bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300',
};

const FALLBACK_BADGE =
  'bg-surface-secondary text-text-secondary dark:bg-surface-tertiary dark:text-text-secondary';

/** Left accent for the priority `<select>` in TaskDetailModal */
export const PRIORITY_SELECT_ACCENT: Record<TaskPriority, string> = {
  low: 'border-l-[3px] border-l-slate-500',
  medium: 'border-l-[3px] border-l-amber-500',
  high: 'border-l-[3px] border-l-orange-500',
  urgent: 'border-l-[3px] border-l-red-500',
};

export function priorityBadgeClass(priority: string | undefined): string {
  if (!priority) return FALLBACK_BADGE;
  if (priority in PRIORITY_BADGE_CLASSES) {
    return PRIORITY_BADGE_CLASSES[priority as TaskPriority];
  }
  return FALLBACK_BADGE;
}

export function prioritySelectAccentClass(priority: TaskPriority | ''): string {
  if (!priority) return '';
  return PRIORITY_SELECT_ACCENT[priority] ?? '';
}

export function formatPriorityLabel(priority: string): string {
  if (!priority) return '';
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}
