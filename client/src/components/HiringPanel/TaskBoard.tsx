/* eslint-disable i18next/no-literal-string */
import React, { useState, useRef, useEffect } from 'react';
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@librechat/client';
import type { Task, TaskStatus, CreateTaskInput, AssignableUser } from './types';
import type { BoardColumn } from '~/hooks/useHiringColumns';
import TaskCard from './TaskCard';
import TaskDetailModal from './TaskDetailModal';

interface TaskBoardProps {
  tasks: Task[];
  loading: boolean;
  columns: BoardColumn[];
  onCreateTask: (data: CreateTaskInput) => Promise<Task | void>;
  onUpdateTask: (id: string, data: Partial<Task>) => Promise<Task>;
  onDeleteTask: (id: string) => Promise<void>;
  onCreateColumn: (label: string) => Promise<BoardColumn>;
  onUpdateColumn: (id: string, label: string) => Promise<void>;
  onDeleteColumn: (id: string) => Promise<void>;
  onUploadTaskImage: (taskId: string, file: File) => Promise<Task>;
  assignableUsers: AssignableUser[];
  onSwitchToTeam?: () => void;
}

export default function TaskBoard({
  tasks,
  loading,
  columns,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  onUploadTaskImage,
  assignableUsers,
}: TaskBoardProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [creating, setCreating] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [savingColumn, setSavingColumn] = useState(false);
  const columnInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameCommitLock = useRef(false);
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    if (renamingColumnId) {
      const t = window.setTimeout(() => renameInputRef.current?.select(), 0);
      return () => window.clearTimeout(t);
    }
  }, [renamingColumnId]);

  const startRename = (col: BoardColumn) => {
    setRenamingColumnId(col._id);
    setRenameDraft(col.label);
  };

  const cancelRename = () => {
    setRenamingColumnId(null);
    setRenameDraft('');
  };

  const commitRename = async (col: BoardColumn) => {
    if (renameCommitLock.current) return;
    const next = renameDraft.trim();
    if (!next) {
      cancelRename();
      return;
    }
    if (next === col.label) {
      cancelRename();
      return;
    }
    renameCommitLock.current = true;
    setRenaming(true);
    try {
      await onUpdateColumn(col._id, next);
      cancelRename();
    } finally {
      setRenaming(false);
      renameCommitLock.current = false;
    }
  };

  const startAdding = (colId: string) => {
    setAddingInColumn(colId);
    setNewTitle('');
    setTitleError('');
    setTimeout(() => cardInputRef.current?.focus(), 50);
  };

  const cancelAdding = () => {
    setAddingInColumn(null);
    setNewTitle('');
    setTitleError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setTitleError('Title is required');
      return;
    }
    setTitleError('');
    setCreating(true);
    try {
      const task = await onCreateTask({ title: newTitle.trim() });
      if (task && addingInColumn) {
        const defaultColId = columns[0]?._id;
        if (addingInColumn !== defaultColId) {
          await onUpdateTask((task as Task)._id, { status: addingInColumn as TaskStatus });
        }
      }
      cancelAdding();
    } finally {
      setCreating(false);
    }
  };

  const handleDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;
    const task = tasks.find((t) => t._id === taskId);
    if (task && task.status !== colId) {
      await onUpdateTask(taskId, { status: colId as TaskStatus });
    }
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newColumnTitle.trim();
    if (!title) return;
    setSavingColumn(true);
    try {
      await onCreateColumn(title);
      setNewColumnTitle('');
      setShowAddColumn(false);
    } finally {
      setSavingColumn(false);
    }
  };

  const openAddColumn = () => {
    setShowAddColumn(true);
    setTimeout(() => columnInputRef.current?.focus(), 50);
  };

  // First column catches tasks whose status doesn't match any known column _id
  const getColTasks = (col: BoardColumn, index: number) => {
    if (index === 0) {
      const knownIds = new Set(columns.map((c) => c._id));
      return tasks.filter((t) => t.status === col._id || !knownIds.has(t.status));
    }
    return tasks.filter((t) => t.status === col._id);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Task Board</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} across {columns.length} columns
          </p>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-scroll pb-4">
          {columns.map((col, index) => {
            const colTasks = getColTasks(col, index);
            const isOver = dragOverColumn === col._id;

            return (
              <div
                key={col._id}
                onDrop={(e) => handleDrop(e, col._id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumn(col._id);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                className={`flex w-56 shrink-0 flex-col rounded-xl transition-colors ${
                  isOver ? 'bg-gray-100 dark:bg-gray-700/50' : 'bg-gray-50 dark:bg-gray-800/40'
                }`}
              >
                <div className="flex items-center justify-between gap-1 px-3 pb-2 pt-3">
                  {renamingColumnId === col._id ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void commitRename(col);
                      }}
                    >
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameDraft}
                        disabled={renaming}
                        placeholder="Column name — Enter to save"
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => {
                          if (renaming || renameCommitLock.current) return;
                          void commitRename(col);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                      />
                    </form>
                  ) : (
                    <>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {col.label}
                        </span>
                        <span className="shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {colTasks.length}
                        </span>
                      </div>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                            title="Column options"
                            aria-label="Column options"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[10rem]">
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 dark:text-white"
                            onSelect={() => startRename(col)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Rename
                          </DropdownMenuItem>
                          {columns.length > 1 && (
                            <DropdownMenuItem
                              className="cursor-pointer gap-2 text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/40 dark:focus:text-red-400"
                              onSelect={() => void onDeleteColumn(col._id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 px-3">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      assignableUsers={assignableUsers}
                      onStatusChange={onUpdateTask}
                      onClick={() => setSelectedTask(task)}
                    />
                  ))}
                </div>

                <div className="px-3 pb-3 pt-2">
                  {addingInColumn === col._id ? (
                    <form onSubmit={handleCreate} className="flex flex-col gap-1.5">
                      <input
                        ref={cardInputRef}
                        type="text"
                        placeholder="Card title…"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                      {titleError && <p className="text-xs text-red-500">{titleError}</p>}
                      <div className="flex gap-1.5">
                        <button
                          type="submit"
                          disabled={creating}
                          className="flex-1 rounded-lg bg-gray-900 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={cancelAdding}
                          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => startAdding(col._id)}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add a card
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex w-56 shrink-0 items-start pt-3">
            {showAddColumn ? (
              <form
                onSubmit={handleAddColumn}
                className="w-full rounded-xl bg-gray-50 p-3 dark:bg-gray-800/40"
              >
                <input
                  ref={columnInputRef}
                  type="text"
                  placeholder="Column title..."
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-900 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:border-gray-200 dark:bg-gray-700 dark:text-gray-100"
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingColumn}
                    className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900"
                  >
                    {savingColumn ? 'Saving…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddColumn(false);
                      setNewColumnTitle('');
                    }}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={openAddColumn}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" />
                Add Column
              </button>
            )}
          </div>
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          columns={columns}
          assignableUsers={assignableUsers}
          onSave={async (id, patch) => {
            const updated = await onUpdateTask(id, patch);
            if (selectedTask && selectedTask._id === id) {
              setSelectedTask(updated);
            }
            return updated;
          }}
          onDelete={onDeleteTask}
          onUploadTaskImage={async (id, file) => {
            const updated = await onUploadTaskImage(id, file);
            setSelectedTask(updated);
            return updated;
          }}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
