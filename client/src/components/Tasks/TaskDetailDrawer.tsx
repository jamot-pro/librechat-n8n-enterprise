import React, { useState } from 'react';
import {
  X,
  Calendar,
  User,
  Flag,
  Tag,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  ExternalLink,
} from 'lucide-react';
import {
  useTask,
  useUpdateTask,
  useUpdateTaskStatus,
  useAddComment,
  useDeleteTask,
} from '~/data-provider/task-queries';
import type { Task } from '~/data-provider/tasks';
import { useAuthContext } from '~/hooks/AuthContext';

const STATUS_OPTIONS: { value: Task['status']; label: string; color: string }[] = [
  { value: 'todo', label: 'To Do', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'review', label: 'Review', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  { value: 'done', label: 'Done', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
];

const PRIORITY_STYLES: Record<Task['priority'], string> = {
  low: 'text-gray-500',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-red-600 font-semibold',
};

interface TaskDetailDrawerProps {
  taskId: string;
  onClose: () => void;
}

export default function TaskDetailDrawer({ taskId, onClose }: TaskDetailDrawerProps) {
  const { user } = useAuthContext();
  const { data: task, isLoading } = useTask(taskId);
  const updateTask = useUpdateTask();
  const updateStatus = useUpdateTaskStatus();
  const addComment = useAddComment();
  const deleteTask = useDeleteTask();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [commentText, setCommentText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (isLoading || !task) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white dark:bg-gray-800 shadow-2xl flex items-center justify-center border-l border-gray-200 dark:border-gray-700">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === task.status) ?? STATUS_OPTIONS[0];
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'done' &&
    task.status !== 'cancelled';

  const assigneeName =
    task.assignedToName ||
    (typeof task.assignedTo === 'object' && task.assignedTo
      ? task.assignedTo.name || task.assignedTo.username
      : null);

  const creatorName =
    task.createdByName ||
    (typeof task.createdBy === 'object' && task.createdBy
      ? task.createdBy.name || task.createdBy.username
      : 'Unknown');

  const handleSaveTitle = () => {
    if (titleValue.trim() && titleValue !== task.title) {
      updateTask.mutate({ taskId, data: { title: titleValue.trim() } });
    }
    setEditingTitle(false);
  };

  const handleSaveDesc = () => {
    updateTask.mutate({ taskId, data: { description: descValue.trim() } });
    setEditingDesc(false);
  };

  const handleStatusChange = (status: Task['status']) => {
    updateStatus.mutate({ taskId, status });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment.mutate(
      { taskId, text: commentText.trim() },
      { onSuccess: () => setCommentText('') },
    );
  };

  const handleDelete = () => {
    deleteTask.mutate(taskId, { onSuccess: onClose });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white dark:bg-gray-800 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {isOverdue && (
              <span className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                Overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Delete task"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5">
            {/* Title */}
            <div>
              {editingTitle ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                    onBlur={handleSaveTitle}
                    className="flex-1 text-lg font-semibold bg-transparent border-b-2 border-blue-500 outline-none text-gray-900 dark:text-gray-100 pb-1"
                  />
                </div>
              ) : (
                <div className="flex items-start gap-2 group">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1 leading-snug">
                    {task.title}
                  </h2>
                  <button
                    onClick={() => { setEditingTitle(true); setTitleValue(task.title); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-opacity shrink-0"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Status selector */}
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.slice(0, 4).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      task.status === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Assignee */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
                  <User size={12} />
                  Assigned to
                </div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {assigneeName || <span className="text-gray-400 font-normal">Unassigned</span>}
                </p>
              </div>

              {/* Priority */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
                  <Flag size={12} />
                  Priority
                </div>
                <p className={`text-sm font-medium capitalize ${PRIORITY_STYLES[task.priority]}`}>
                  {task.priority}
                </p>
              </div>

              {/* Due date */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
                  <Calendar size={12} />
                  Due date
                </div>
                {task.dueDate ? (
                  <p className={`text-sm font-medium ${isOverdue ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
                    {new Date(task.dueDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 font-normal">No due date</p>
                )}
              </div>

              {/* Created by */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
                  <User size={12} />
                  Created by
                </div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {creatorName}
                </p>
              </div>
            </div>

            {/* Tags */}
            {task.tags?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                  <Tag size={12} />
                  Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Source reference */}
            {task.source !== 'manual' && (
              <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
                <ExternalLink size={12} />
                <span>
                  Created via{' '}
                  <span className="font-medium text-purple-500">
                    {task.source.replace('_', ' ')}
                  </span>
                  {task.sourceRef && ` — ref: ${task.sourceRef}`}
                </span>
              </div>
            )}

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400">Description</p>
                {!editingDesc && (
                  <button
                    onClick={() => { setEditingDesc(true); setDescValue(task.description || ''); }}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    {task.description ? 'Edit' : 'Add'}
                  </button>
                )}
              </div>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={descValue}
                    onChange={(e) => setDescValue(e.target.value)}
                    rows={4}
                    className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveDesc}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingDesc(false)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {task.description || (
                    <span className="text-gray-300 dark:text-gray-600 italic">No description yet</span>
                  )}
                </p>
              )}
            </div>

            {/* Comments */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-3">
                <MessageSquare size={12} />
                Comments ({task.comments?.length ?? 0})
              </div>

              {/* Comment list */}
              <div className="space-y-3 mb-4">
                {(task.comments ?? []).map((comment) => {
                  const commenterName =
                    comment.userName ||
                    (typeof comment.userId === 'object' ? comment.userId.name : 'Unknown');
                  return (
                    <div key={comment._id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300 shrink-0">
                        {commenterName[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {commenterName}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(comment.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{comment.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* New comment */}
              <form onSubmit={handleComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || addComment.isLoading}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors"
                >
                  <Check size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Delete confirm */}
        {showDeleteConfirm && (
          <div className="absolute inset-x-0 bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-5 shadow-2xl">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
              Delete this task?
            </p>
            <p className="text-xs text-gray-500 mb-4">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteTask.isLoading}
                className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {deleteTask.isLoading ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
