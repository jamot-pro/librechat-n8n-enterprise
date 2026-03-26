/* eslint-disable i18next/no-literal-string */
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Tag,
  AlignLeft,
  CheckSquare,
  Trash2,
  Link,
  Calendar,
  ArrowRight,
  ImagePlus,
  Loader2,
  User,
} from 'lucide-react';
import type { Task, TaskPriority, ChecklistItem, TaskAttachment, AssignableUser } from './types';
import type { BoardColumn } from '~/hooks/useHiringColumns';
import { prioritySelectAccentClass } from './priorityStyles';

const LABEL_OPTIONS = [
  {
    name: 'Bug',
    color:
      'bg-red-100 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  },
  {
    name: 'Feature',
    color:
      'bg-green-100 text-green-700 border-green-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  {
    name: 'Design',
    color:
      'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  {
    name: 'Urgent',
    color:
      'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  },
  {
    name: 'Research',
    color:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  {
    name: 'Review',
    color:
      'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-800',
  },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

/** Build a usable `img` src from API filepath (absolute URL vs app-relative `/images/...`). */
function attachmentImageSrc(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return url.startsWith('/') ? url : `/${url}`;
}

interface TaskDetailModalProps {
  task: Task;
  columns: BoardColumn[];
  assignableUsers: AssignableUser[];
  onSave: (id: string, patch: Partial<Task>) => Promise<Task>;
  onDelete: (id: string) => Promise<void>;
  onUploadTaskImage: (taskId: string, file: File) => Promise<Task>;
  onClose: () => void;
}

export default function TaskDetailModal({
  task,
  columns,
  assignableUsers,
  onSave,
  onDelete,
  onUploadTaskImage,
  onClose,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  /** Column id at runtime (see TaskBoard); API types use TaskStatus loosely */
  const [status, setStatus] = useState<string>(task.status);
  const [priority, setPriority] = useState<TaskPriority | ''>(task.priority || '');
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '');
  const [assignee, setAssignee] = useState<string>(task.assignee || '');
  const [labels, setLabels] = useState<string[]>(task.labels || []);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist || []);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [attachments, setAttachments] = useState<TaskAttachment[]>(task.attachments || []);
  const [imageUploading, setImageUploading] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Reset form when switching tasks (modal stays mounted; `selectedTask` changes). */
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setPriority(task.priority || '');
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
    setAssignee(task.assignee || '');
    setLabels(task.labels || []);
    setChecklist(task.checklist || []);
    setAttachments(task.attachments || []);
    setNewCheckItem('');
    setSaving(false);
    setDeleting(false);
    setImageUploading(false);
    titleRef.current?.focus();
  }, [task._id]);

  const toggleLabel = (name: string) => {
    setLabels((prev) => (prev.includes(name) ? prev.filter((l) => l !== name) : [...prev, name]));
  };

  const addCheckItem = () => {
    const text = newCheckItem.trim();
    if (!text) return;
    setChecklist((prev) => [...prev, { text, done: false }]);
    setNewCheckItem('');
  };

  const toggleCheckItem = (index: number) => {
    setChecklist((prev) =>
      prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item)),
    );
  };

  const removeCheckItem = (index: number) => {
    setChecklist((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(task._id, {
        title: title.trim(),
        description,
        status: status as Task['status'],
        priority: priority || undefined,
        dueDate: dueDate || undefined,
        assignee: assignee || '',
        labels,
        checklist,
        attachments,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if ((attachments.length || 0) >= 10) return;
    setImageUploading(true);
    try {
      const updated = await onUploadTaskImage(task._id, file);
      setAttachments(updated.attachments || []);
    } finally {
      setImageUploading(false);
    }
  };

  const removeAttachment = async (fileId: string) => {
    const prev = attachments;
    const next = prev.filter((a) => a.fileId !== fileId);
    setAttachments(next);
    try {
      const updated = await onSave(task._id, { attachments: next });
      setAttachments(updated.attachments || []);
    } catch {
      setAttachments(prev);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    setDeleting(true);
    try {
      await onDelete(task._id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/dashboard/tasks?task=${task._id}`);
  };

  /** Tailwind preflight uses `appearance: none` on inputs, which breaks native date UI; `showPicker` is a reliable fallback (Chromium / modern Safari). */
  const openNativeDatePicker = (e: React.MouseEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (typeof el.showPicker === 'function') {
      try {
        void el.showPicker();
      } catch {
        /* ignore: unsupported or security */
      }
    }
  };

  const inputBase =
    'rounded-lg border border-border-medium bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-border-heavy focus:outline-none focus:ring-0';
  const sectionLabel = 'flex items-center gap-2 text-sm font-medium text-text-secondary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black opacity-50 dark:opacity-80"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border border-border-light bg-background shadow-2xl backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm p-1 text-text-primary opacity-70 transition-opacity hover:bg-surface-hover hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-border-xheavy"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col gap-5 p-6 pt-5">
          {/* Title */}
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              /* Prevent bubbling Enter to a parent <form> (would submit & reload the page). */
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            className="w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-base font-semibold text-text-primary placeholder:text-text-secondary focus:border-border-heavy focus:outline-none"
            placeholder="Task title"
          />

          {/* Status */}
          <div className="flex items-center gap-3">
            <ArrowRight className="h-4 w-4 shrink-0 text-text-secondary" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputBase}
            >
              {columns.map((col) => (
                <option key={col._id} value={col._id}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-3">
            <span className="w-16 text-sm text-text-secondary">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority | '')}
              className={`${inputBase} min-w-0 flex-1 pl-3 ${prioritySelectAccentClass(priority)}`}
            >
              <option value="">None</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 shrink-0 text-text-secondary" />
            <span className="w-16 shrink-0 text-sm text-text-secondary">Assignee</span>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className={`${inputBase} min-w-0 flex-1`}
            >
              <option value="">Unassigned</option>
              {assignee && !assignableUsers.some((u) => u.id === assignee) && (
                <option
                  value={assignee}
                >{`User no longer in list (${assignee.slice(0, 8)}…)`}</option>
              )}
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                  {u.email ? ` · ${u.email}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 shrink-0 text-text-secondary" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onClick={openNativeDatePicker}
              className={`${inputBase} min-h-10 min-w-0 flex-1 cursor-pointer appearance-auto [color-scheme:inherit]`}
            />
          </div>

          {/* Labels */}
          <div className="flex flex-col gap-2">
            <div className={sectionLabel}>
              <Tag className="h-4 w-4 text-text-secondary" />
              <span>Labels</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {LABEL_OPTIONS.map((l) => (
                <button
                  key={l.name}
                  type="button"
                  onClick={() => toggleLabel(l.name)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-opacity ${l.color} ${
                    labels.includes(l.name)
                      ? 'opacity-100 ring-2 ring-border-heavy ring-offset-1 ring-offset-background dark:ring-offset-background'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <div className={sectionLabel}>
              <AlignLeft className="h-4 w-4 text-text-secondary" />
              <span>Description</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add a description…"
              className="w-full resize-y rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-heavy focus:outline-none"
            />
          </div>

          {/* Attachments (images via S3/local file pipeline) */}
          <div className="flex flex-col gap-2">
            <div className={sectionLabel}>
              <ImagePlus className="h-4 w-4 text-text-secondary" />
              <span>Attachments</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelected}
            />
            <div className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div
                  key={a.fileId}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-border-medium bg-surface-secondary"
                >
                  <img
                    src={attachmentImageSrc(a.url)}
                    alt={a.filename || 'Attachment'}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => void removeAttachment(a.fileId)}
                    className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/20 backdrop-blur-[2px] transition-colors hover:bg-red-600 hover:ring-red-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-xheavy focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                    title="Delete attachment"
                    aria-label="Delete attachment"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </div>
              ))}
              {attachments.length < 10 && (
                <button
                  type="button"
                  onClick={handlePickImage}
                  disabled={imageUploading}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-medium bg-surface-secondary text-xs text-text-secondary transition-colors hover:border-border-heavy hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
                >
                  {imageUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5" />
                      Add image
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Checklist */}
          <div className="flex flex-col gap-2">
            <div className={sectionLabel}>
              <CheckSquare className="h-4 w-4 text-text-secondary" />
              <span>Checklist</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleCheckItem(i)}
                    className="h-4 w-4 rounded border-border-medium accent-text-primary"
                  />
                  <span
                    className={`flex-1 text-sm ${item.done ? 'text-text-secondary line-through' : 'text-text-primary'}`}
                  >
                    {item.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCheckItem(i)}
                    className="text-text-secondary hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    addCheckItem();
                  }
                }}
                placeholder="Add an item..."
                className={`flex-1 ${inputBase} placeholder:text-text-secondary`}
              />
              <button
                type="button"
                onClick={addCheckItem}
                className="rounded-lg border border-border-medium bg-surface-secondary px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-hover"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-medium px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-50 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              <Link className="h-4 w-4" />
              Copy Link
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-medium bg-surface-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="rounded-lg bg-text-primary px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-gray-900"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
