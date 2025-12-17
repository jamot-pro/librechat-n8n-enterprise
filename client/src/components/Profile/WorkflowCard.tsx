import React from 'react';
import { cn } from '~/utils';

export interface WorkflowCardProps {
  workflowId: string;
  workflowName: string;
  endpoint: string;
  description: string;
  onExecute?: (workflowId: string) => void;
  isExecuting?: boolean;
}

export default function WorkflowCard({
  workflowId,
  workflowName,
  endpoint,
  description,
  onExecute,
  isExecuting = false,
}: WorkflowCardProps) {
  const handleExecute = () => {
    if (onExecute && !isExecuting) {
      onExecute(workflowId);
    }
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border-light bg-surface-primary-alt',
        'transition-all duration-200 hover:border-border-medium hover:shadow-md',
        isExecuting && 'cursor-wait opacity-60',
      )}
    >
      <div className="p-6">
        {/* Workflow Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="mb-1 text-lg font-semibold text-text-primary">{workflowName}</h3>
            <p className="font-mono text-xs text-text-secondary">{endpoint}</p>
          </div>
          <div className="ml-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-tertiary text-text-secondary">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Workflow Description */}
        <p className="mb-4 line-clamp-2 text-sm text-text-secondary">{description}</p>

        {/* Action Button */}
        <button
          onClick={handleExecute}
          disabled={isExecuting}
          className={cn(
            'w-full rounded-lg px-4 py-2.5 text-sm font-medium',
            'bg-surface-tertiary text-text-primary',
            'transition-colors hover:bg-surface-hover',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'flex items-center justify-center gap-2',
          )}
        >
          {isExecuting ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Executing...</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Execute Workflow</span>
            </>
          )}
        </button>
      </div>

      {/* Status Indicator */}
      <div className="absolute right-0 top-0 m-4">
        <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600">
          <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
          Active
        </div>
      </div>
    </div>
  );
}
