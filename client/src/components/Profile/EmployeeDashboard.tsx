import React, { useState } from 'react';
import WorkflowCard from './WorkflowCard';
import ProfileStats from './ProfileStats';
import { useToastContext } from '@librechat/client';

export default function EmployeeDashboard({ profile }: { profile: any }) {
  const [executingWorkflow, setExecutingWorkflow] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const { showToast } = useToastContext();

  const stats = [
    {
      title: 'Tasks Completed',
      value: '47',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
      trend: { value: 15.3, isPositive: true },
      subtitle: 'This month',
    },
    {
      title: 'Active Tasks',
      value: '12',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      subtitle: 'In progress',
    },
    {
      title: 'Documents',
      value: '234',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      subtitle: 'Accessible',
    },
    {
      title: 'Team Size',
      value: '8',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      subtitle: 'Members',
    },
  ];

  const handleExecuteWorkflow = async (workflowId: string) => {
    setExecutingWorkflow(workflowId);
    setWorkflowResult(null);

    try {
      const workflow = profile?.allowedWorkflows?.find((w: any) => w.workflowId === workflowId);

      showToast({
        message: `Executing ${workflow?.workflowName || 'workflow'}...`,
        status: 'success',
      });

      // Call n8n webhook endpoint
      const n8nBaseUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678';

      // Build payload with workflow-specific parameters
      const basePayload = {
        userId: profile?.userId,
        profileType: profile?.profileType,
        workflowId: workflowId,
        permissions: profile?.permissions || [],
        metadata: profile?.metadata || {},
        timestamp: new Date().toISOString(),
      };

      // Add workflow-specific parameters
      let payload = { ...basePayload };
      if (workflowId === 'wf_doc_search') {
        payload = { ...payload, query: 'employee' }; // Default search query
      } else if (workflowId === 'wf_task_management') {
        payload = { ...payload, action: 'list' }; // Default action: list tasks
      }

      const response = await fetch(`${n8nBaseUrl}${workflow?.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      // Check both HTTP status and workflow success field
      const isSuccess = response.ok && result.success !== false;

      setWorkflowResult({
        workflowName: workflow?.workflowName,
        status: isSuccess ? 'success' : 'error',
        data: isSuccess ? result : undefined,
        error: !isSuccess ? result.error || 'Workflow execution failed' : undefined,
        timestamp: new Date().toLocaleString(),
      });

      setShowResultModal(true);

      if (isSuccess) {
        showToast({
          message: `${workflow?.workflowName} executed successfully!`,
          status: 'success',
        });
      } else {
        showToast({
          message: `${workflow?.workflowName} failed: ${result.error || 'Unknown error'}`,
          status: 'error',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      setWorkflowResult({
        workflowName: 'Workflow',
        status: 'error',
        error: errorMessage,
        timestamp: new Date().toLocaleString(),
      });

      setShowResultModal(true);

      showToast({
        message: `Failed to execute workflow: ${errorMessage}`,
        status: 'error',
      });
    } finally {
      setExecutingWorkflow(null);
    }
  };

  return (
    <div className="w-full space-y-6 pb-8">
      {/* Header */}
      <div className="border-b border-border-light pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Employee Dashboard</h1>
            <p className="mt-2 text-text-secondary">
              Your tasks, documents, and team collaboration tools
            </p>
          </div>
          <div className="rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-600">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
              Employee Access
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <ProfileStats stats={stats} />

      {/* Recent Activity */}
      <div className="rounded-lg border border-border-light bg-surface-primary-alt p-6">
        <h3 className="mb-4 text-lg font-semibold text-text-primary">Recent Activity</h3>
        <div className="space-y-3">
          {[
            {
              action: 'Completed task',
              title: 'Q4 Budget Review',
              time: '2 hours ago',
              icon: 'check',
            },
            {
              action: 'Uploaded document',
              title: 'Project Proposal.pdf',
              time: '5 hours ago',
              icon: 'upload',
            },
            {
              action: 'Joined meeting',
              title: 'Team Standup',
              time: 'Yesterday',
              icon: 'video',
            },
          ].map((activity, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border border-border-light bg-surface-primary p-3 transition-colors hover:border-border-medium"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-tertiary">
                {activity.icon === 'check' && (
                  <svg
                    className="h-4 w-4 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {activity.icon === 'upload' && (
                  <svg
                    className="h-4 w-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                )}
                {activity.icon === 'video' && (
                  <svg
                    className="h-4 w-4 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{activity.action}</p>
                <p className="text-xs text-text-secondary">{activity.title}</p>
              </div>
              <span className="text-xs text-text-secondary">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Workflows Section */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Available Workflows</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Execute your assigned workflows and automation tools
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profile?.allowedWorkflows?.map((workflow: any) => (
            <WorkflowCard
              key={workflow.workflowId}
              {...workflow}
              onExecute={handleExecuteWorkflow}
              isExecuting={executingWorkflow === workflow.workflowId}
            />
          ))}
        </div>

        {(!profile?.allowedWorkflows || profile.allowedWorkflows.length === 0) && (
          <div className="rounded-lg border border-border-light bg-surface-primary-alt p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-text-primary">No workflows available</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Contact your manager to get access to department workflows.
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-border-light bg-surface-primary-alt p-6">
        <h3 className="mb-4 text-lg font-semibold text-text-primary">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button className="flex flex-col items-center gap-2 rounded-lg border border-border-light bg-surface-primary p-4 text-center transition-all hover:border-border-medium hover:shadow-sm">
            <svg
              className="h-6 w-6 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">New Task</span>
          </button>
          <button className="flex flex-col items-center gap-2 rounded-lg border border-border-light bg-surface-primary p-4 text-center transition-all hover:border-border-medium hover:shadow-sm">
            <svg
              className="h-6 w-6 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">Search Docs</span>
          </button>
          <button className="flex flex-col items-center gap-2 rounded-lg border border-border-light bg-surface-primary p-4 text-center transition-all hover:border-border-medium hover:shadow-sm">
            <svg
              className="h-6 w-6 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">Calendar</span>
          </button>
          <button className="flex flex-col items-center gap-2 rounded-lg border border-border-light bg-surface-primary p-4 text-center transition-all hover:border-border-medium hover:shadow-sm">
            <svg
              className="h-6 w-6 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">Team</span>
          </button>
        </div>
      </div>

      {/* Workflow Result Modal */}
      {showResultModal && workflowResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-border-light bg-surface-primary shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 border-b border-border-light bg-surface-primary-alt p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-text-primary">
                    Workflow Execution Result
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">{workflowResult.workflowName}</p>
                </div>
                <button
                  onClick={() => setShowResultModal(false)}
                  className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Status Badge */}
              <div className="mb-4 flex items-center gap-2">
                {workflowResult.status === 'success' ? (
                  <div className="flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-600">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Success
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-600">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Error
                  </div>
                )}
                <span className="text-xs text-text-secondary">{workflowResult.timestamp}</span>
              </div>

              {/* Result Data */}
              {workflowResult.status === 'success' && workflowResult.data && (
                <div className="space-y-4">
                  {/* Summary Section */}
                  {workflowResult.data.summary && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-blue-900">Summary</h4>
                      <p className="text-sm text-blue-700">{workflowResult.data.summary}</p>
                    </div>
                  )}

                  {/* Key Insights */}
                  {workflowResult.data.insights && workflowResult.data.insights.length > 0 && (
                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                      <h4 className="mb-3 text-sm font-semibold text-text-primary">Key Insights</h4>
                      <div className="space-y-2">
                        {workflowResult.data.insights.map((insight: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            <svg
                              className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <p className="text-sm text-text-secondary">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Task Management Results */}
                  {workflowResult.data.data?.tasks && workflowResult.data.data.tasks.length > 0 && (
                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                      <h4 className="mb-3 text-sm font-semibold text-text-primary">Your Tasks</h4>
                      <div className="space-y-2">
                        {workflowResult.data.data.tasks.map((task: any, idx: number) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-border-light bg-surface-primary p-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-medium text-text-primary">{task.title}</h5>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      task.status === 'completed'
                                        ? 'bg-green-100 text-green-700'
                                        : task.status === 'in-progress'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {task.status}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      task.priority === 'high'
                                        ? 'bg-red-100 text-red-700'
                                        : task.priority === 'medium'
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {task.priority}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {task.description}
                                </p>
                                <p className="mt-2 text-xs text-text-secondary">
                                  Due: {task.dueDate}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Document Search Results */}
                  {workflowResult.data.data?.documents &&
                    workflowResult.data.data.documents.length > 0 && (
                      <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                        <h4 className="mb-3 text-sm font-semibold text-text-primary">
                          Search Results
                        </h4>
                        <div className="space-y-3">
                          {workflowResult.data.data.documents.map((doc: any, idx: number) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-border-light bg-surface-primary p-4 transition-colors hover:border-border-medium"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <svg
                                      className="h-5 w-5 text-blue-500"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                      />
                                    </svg>
                                    <h5 className="font-semibold text-text-primary">{doc.title}</h5>
                                  </div>
                                  <p className="mt-2 text-sm text-text-secondary">{doc.excerpt}</p>
                                  <div className="mt-3 flex items-center gap-3 text-xs text-text-secondary">
                                    <span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-700">
                                      {doc.category}
                                    </span>
                                    <span>Updated: {doc.lastUpdated}</span>
                                    <span>•</span>
                                    <span className="cursor-pointer text-blue-600 hover:underline">
                                      {doc.url}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Stats Display */}
                  {workflowResult.data.data?.stats && (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(workflowResult.data.data.stats).map(
                        ([key, value]: [string, any]) => (
                          <div
                            key={key}
                            className="rounded-lg border border-border-light bg-surface-primary p-3"
                          >
                            <p className="text-xs font-medium capitalize text-text-secondary">
                              {key.replace(/([A-Z])/g, ' $1')}
                            </p>
                            <p className="mt-1 text-lg font-bold text-text-primary">{value}</p>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {workflowResult.status === 'error' && workflowResult.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <h4 className="mb-2 text-sm font-semibold text-red-900">Error Details:</h4>
                  <p className="text-sm text-red-700">{workflowResult.error}</p>
                  <p className="mt-2 text-xs text-red-600">
                    Make sure n8n is running and the webhook endpoint is accessible.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border-light bg-surface-primary-alt p-4">
              <button
                onClick={() => setShowResultModal(false)}
                className="w-full rounded-lg bg-surface-tertiary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
