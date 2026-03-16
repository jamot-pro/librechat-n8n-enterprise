import React, { useState, useRef, useEffect } from 'react';
import { X, Search, User, Calendar, Tag, AlertCircle } from 'lucide-react';
import { useCreateTask } from '~/data-provider/task-queries';
import { searchUsers, type UserSearchResult } from '~/data-provider/tasks';
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-gray-500' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' },
] as const;

interface TaskCreateModalProps {
  onClose: () => void;
  prefill?: {
    title?: string;
    description?: string;
    sourceRef?: string;
    tags?: string[];
  };
}

function getInitial(name?: string | null, username?: string | null): string {
  return (name || username || '?')[0].toUpperCase();
}

export default function TaskCreateModal({ onClose, prefill = {} }: TaskCreateModalProps) {
  const createTask = useCreateTask();

  const [title, setTitle] = useState(prefill.title || '');
  const [description, setDescription] = useState(prefill.description || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(prefill.tags || []);

  // Assignee search
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<UserSearchResult[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<UserSearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Debounced user search
  useEffect(() => {
    if (!assigneeQuery.trim() || assigneeQuery.length < 2) {
      setAssigneeResults([]);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchUsers(assigneeQuery);
        setAssigneeResults(results);
      } catch {
        setAssigneeResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [assigneeQuery]);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Title is required');
      titleRef.current?.focus();
      return;
    }

    createTask.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedToId: selectedAssignee?._id,
        assignedToName: selectedAssignee?.name || selectedAssignee?.username,
        priority,
        dueDate: dueDate || undefined,
        tags,
        sourceRef: prefill.sourceRef,
      },
      {
        onSuccess: () => onClose(),
        onError: (err: any) => setError(err?.message || 'Failed to create task'),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">New Task</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Title */}
            <div>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                maxLength={200}
                className="w-full text-base font-medium bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 outline-none pb-2 text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
                maxLength={2000}
                className="w-full text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Assignee search */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <User size={12} />
                Assign to
              </label>
              {selectedAssignee ? (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                      {getInitial(selectedAssignee.name, selectedAssignee.username)}
                    </div>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {selectedAssignee.name || selectedAssignee.username}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedAssignee(null); setAssigneeQuery(''); }}
                    className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={assigneeQuery}
                    onChange={(e) => setAssigneeQuery(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Results dropdown */}
                  {assigneeResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden">
                      {assigneeResults.map((u) => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => { setSelectedAssignee(u); setAssigneeQuery(''); setAssigneeResults([]); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300 shrink-0">
                            {getInitial(u.name, u.username)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{u.name}</p>
                            <p className="text-xs text-gray-400">@{u.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchLoading && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-400">
                      Searching...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Priority + Due Date row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Priority
                </label>
                <div className="flex gap-1 flex-wrap">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                        priority === opt.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                  <Calendar size={12} />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <Tag size={12} />
                Tags <span className="font-normal">(press Enter)</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Add tag..."
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3 shrink-0 bg-white dark:bg-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTask.isLoading || !title.trim()}
              className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              {createTask.isLoading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
