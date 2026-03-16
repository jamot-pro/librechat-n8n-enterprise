import React, { useState, useRef } from 'react';
import { Plus, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { useTaskBoard, useTaskStats, useUpdateTaskStatus } from '~/data-provider/task-queries';
import type { Task, KanbanBoard } from '~/data-provider/tasks';
import TaskCard from './TaskCard';
import TaskCreateModal from './TaskCreateModal';
import TaskDetailDrawer from './TaskDetailDrawer';

const COLUMNS: {
  key: keyof KanbanBoard;
  label: string;
  color: string;
  dotColor: string;
}[] = [
  { key: 'todo', label: 'To Do', color: 'border-t-gray-400', dotColor: 'bg-gray-400' },
  {
    key: 'in_progress',
    label: 'In Progress',
    color: 'border-t-blue-500',
    dotColor: 'bg-blue-500',
  },
  { key: 'review', label: 'Review', color: 'border-t-yellow-500', dotColor: 'bg-yellow-500' },
  { key: 'done', label: 'Done', color: 'border-t-green-500', dotColor: 'bg-green-500' },
];

export default function TaskBoard() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragSourceCol = useRef<string | null>(null);

  const { data: board, isLoading, refetch } = useTaskBoard();
  const { data: stats } = useTaskStats();
  const updateStatus = useUpdateTaskStatus();

  // ── Drag & Drop ───────────────────────────────────────────
  const handleDragStart = (task: Task, colKey: string) => {
    setDraggingTask(task);
    dragSourceCol.current = colKey;
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(colKey);
  };

  const handleDrop = (e: React.DragEvent, targetCol: keyof KanbanBoard) => {
    e.preventDefault();
    if (!draggingTask || draggingTask.status === targetCol) {
      setDraggingTask(null);
      setDragOverCol(null);
      return;
    }
    updateStatus.mutate({ taskId: draggingTask._id, status: targetCol });
    setDraggingTask(null);
    setDragOverCol(null);
  };

  const handleDragEnd = () => {
    setDraggingTask(null);
    setDragOverCol(null);
  };

  // ── Render ────────────────────────────────────────────────
  const overdueCount = stats?.overdue ?? 0;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tasks</h1>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              {stats && (
                <>
                  <span>{stats.total} total</span>
                  {overdueCount > 0 && (
                    <span className="text-red-500 font-medium">⚠ {overdueCount} overdue</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            New Task
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {isLoading ? (
          <div className="flex gap-4 h-full">
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                className="w-72 shrink-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map((col) => {
              const tasks = board?.[col.key] ?? [];
              const isDropTarget = dragOverCol === col.key && draggingTask?.status !== col.key;

              return (
                <div
                  key={col.key}
                  className={`
                    w-72 shrink-0 flex flex-col rounded-xl border-t-4 transition-colors
                    ${col.color}
                    ${
                      isDropTarget
                        ? 'bg-blue-50 dark:bg-blue-900/10 border-gray-200 dark:border-gray-700 border shadow-inner'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                    }
                  `}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDrop={(e) => handleDrop(e, col.key as keyof KanbanBoard)}
                  onDragLeave={() => setDragOverCol(null)}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {col.label}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {tasks.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {tasks.length === 0 && (
                      <div
                        className={`
                          flex items-center justify-center h-24 rounded-lg border-2 border-dashed text-sm text-gray-300 dark:text-gray-600
                          ${isDropTarget ? 'border-blue-400 dark:border-blue-600 text-blue-400' : 'border-gray-200 dark:border-gray-700'}
                        `}
                      >
                        {isDropTarget ? 'Drop here' : 'No tasks'}
                      </div>
                    )}
                    {tasks.map((task) => (
                      <div
                        key={task._id}
                        draggable
                        onDragStart={() => handleDragStart(task, col.key)}
                        onDragEnd={handleDragEnd}
                      >
                        <TaskCard
                          task={task}
                          onClick={setSelectedTask}
                          isDragging={draggingTask?._id === task._id}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Add task shortcut at bottom of column */}
                  <div className="px-3 pb-3 shrink-0">
                    <button
                      onClick={() => setShowCreate(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Plus size={13} />
                      Add task
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <TaskCreateModal onClose={() => setShowCreate(false)} />
      )}
      {selectedTask && (
        <TaskDetailDrawer
          taskId={selectedTask._id}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
