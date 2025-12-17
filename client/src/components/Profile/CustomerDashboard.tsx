import React, { useState } from 'react';
import WorkflowCard from './WorkflowCard';
import ProfileStats from './ProfileStats';
import { useToastContext } from '@librechat/client';

export default function CustomerDashboard({ profile }: { profile: any }) {
  const [executingWorkflow, setExecutingWorkflow] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const { showToast } = useToastContext();

  const stats = [
    {
      title: 'Active Projects',
      value: '3',
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
      subtitle: 'In progress',
    },
    {
      title: 'Support Tickets',
      value: '7',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      trend: { value: 12.5, isPositive: false },
      subtitle: 'Open tickets',
    },
    {
      title: 'Documents',
      value: '45',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
      subtitle: 'Shared files',
    },
    {
      title: 'Account Status',
      value: 'Active',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      subtitle: 'Premium plan',
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
      if (workflowId === 'wf_support_ticket') {
        payload = { ...payload, action: 'list' }; // Default: list existing tickets
      } else if (workflowId === 'wf_project_status') {
        // No additional params needed - will list all projects by default
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
            <h1 className="text-3xl font-bold text-text-primary">Customer Portal</h1>
            <p className="mt-2 text-text-secondary">
              Track your projects, support tickets, and account information
            </p>
          </div>
          <div className="rounded-lg bg-green-500/10 px-4 py-2 text-sm font-medium text-green-600">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
              Customer Access
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <ProfileStats stats={stats} />

      {/* Project Status */}
      <div className="rounded-lg border border-border-light bg-surface-primary-alt p-6">
        <h3 className="mb-4 text-lg font-semibold text-text-primary">Current Projects</h3>
        <div className="space-y-3">
          {[
            {
              name: 'Website Redesign',
              status: 'In Progress',
              progress: 75,
              dueDate: 'Dec 25, 2025',
              statusColor: 'blue',
            },
            {
              name: 'Mobile App Development',
              status: 'Review',
              progress: 90,
              dueDate: 'Dec 20, 2025',
              statusColor: 'purple',
            },
            {
              name: 'Marketing Campaign',
              status: 'Planning',
              progress: 30,
              dueDate: 'Jan 15, 2026',
              statusColor: 'yellow',
            },
          ].map((project, index) => (
            <div
              key={index}
              className="rounded-lg border border-border-light bg-surface-primary p-4 transition-colors hover:border-border-medium"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-text-primary">{project.name}</h4>
                  <p className="mt-1 text-xs text-text-secondary">Due: {project.dueDate}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    project.statusColor === 'blue'
                      ? 'bg-blue-500/10 text-blue-600'
                      : project.statusColor === 'purple'
                        ? 'bg-purple-500/10 text-purple-600'
                        : 'bg-yellow-500/10 text-yellow-600'
                  }`}
                >
                  {project.status}
                </span>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-tertiary">
                  <div
                    className={`h-full rounded-full ${
                      project.statusColor === 'blue'
                        ? 'bg-blue-600'
                        : project.statusColor === 'purple'
                          ? 'bg-purple-600'
                          : 'bg-yellow-600'
                    }`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workflows Section */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Available Services</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Self-service tools and support workflows
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
            <h3 className="mt-4 text-sm font-medium text-text-primary">No services available</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Contact support to activate customer services for your account.
            </p>
          </div>
        )}
      </div>

      {/* Support & Help */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border-light bg-surface-primary-alt p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
            <svg
              className="h-5 w-5 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Need Help?
          </h3>
          <p className="mb-4 text-sm text-text-secondary">
            Our support team is here to assist you with any questions or issues.
          </p>
          <button className="w-full rounded-lg bg-surface-tertiary px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover">
            Contact Support
          </button>
        </div>

        <div className="rounded-lg border border-border-light bg-surface-primary-alt p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
            <svg
              className="h-5 w-5 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Documentation
          </h3>
          <p className="mb-4 text-sm text-text-secondary">
            Browse our knowledge base and guides for self-service help.
          </p>
          <button className="w-full rounded-lg bg-surface-tertiary px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover">
            View Docs
          </button>
        </div>
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">New Ticket</span>
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">View Invoices</span>
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
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">Messages</span>
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">Settings</span>
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

              {/* Success Results */}
              {workflowResult.status === 'success' && workflowResult.data && (
                <div className="space-y-4">
                  {/* Summary Section */}
                  {workflowResult.data.summary && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-green-900">Summary</h4>
                      <p className="text-sm text-green-700">{workflowResult.data.summary}</p>
                    </div>
                  )}

                  {/* Message Section */}
                  {workflowResult.data.message && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm text-blue-700">{workflowResult.data.message}</p>
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
                              className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500"
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

                  {/* Next Steps */}
                  {workflowResult.data.nextSteps && workflowResult.data.nextSteps.length > 0 && (
                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                      <h4 className="mb-3 text-sm font-semibold text-text-primary">Next Steps</h4>
                      <ol className="space-y-2">
                        {workflowResult.data.nextSteps.map((step: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                              {idx + 1}
                            </span>
                            <p className="text-sm text-text-secondary">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Project Status Details */}
                  {workflowResult.data.project && (
                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                      <h4 className="mb-3 text-sm font-semibold text-text-primary">
                        Project Details
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <h5 className="font-semibold text-text-primary">
                            {workflowResult.data.project.name}
                          </h5>
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                workflowResult.data.project.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : workflowResult.data.project.status === 'in-progress'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {workflowResult.data.project.status}
                            </span>
                            <span className="text-xs text-text-secondary">
                              {workflowResult.data.project.progress}% complete
                            </span>
                          </div>
                        </div>
                        <div className="w-full rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: `${workflowResult.data.project.progress}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-text-secondary">Start Date</p>
                            <p className="font-medium text-text-primary">
                              {workflowResult.data.project.startDate}
                            </p>
                          </div>
                          <div>
                            <p className="text-text-secondary">Est. Completion</p>
                            <p className="font-medium text-text-primary">
                              {workflowResult.data.project.estimatedCompletion}
                            </p>
                          </div>
                          <div>
                            <p className="text-text-secondary">Budget</p>
                            <p className="font-medium text-text-primary">
                              ${(workflowResult.data.project.budget / 1000).toFixed(0)}K
                            </p>
                          </div>
                          <div>
                            <p className="text-text-secondary">Spent</p>
                            <p className="font-medium text-text-primary">
                              ${(workflowResult.data.project.spent / 1000).toFixed(0)}K (
                              {Math.round(
                                (workflowResult.data.project.spent /
                                  workflowResult.data.project.budget) *
                                  100,
                              )}
                              %)
                            </p>
                          </div>
                        </div>
                        {workflowResult.data.project.milestones &&
                          workflowResult.data.project.milestones.length > 0 && (
                            <div>
                              <h6 className="mb-2 text-xs font-semibold text-text-primary">
                                Milestones
                              </h6>
                              <div className="space-y-1">
                                {workflowResult.data.project.milestones.map(
                                  (milestone: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <span className="text-text-secondary">{milestone.name}</span>
                                      <span
                                        className={`rounded-full px-2 py-0.5 font-medium ${
                                          milestone.status === 'completed'
                                            ? 'bg-green-100 text-green-700'
                                            : milestone.status === 'in-progress'
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-gray-100 text-gray-700'
                                        }`}
                                      >
                                        {milestone.status}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Projects List */}
                  {workflowResult.data.projects && workflowResult.data.projects.length > 0 && (
                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                      <h4 className="mb-3 text-sm font-semibold text-text-primary">
                        Your Projects
                      </h4>
                      <div className="space-y-3">
                        {workflowResult.data.projects.map((project: any, idx: number) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-border-light bg-surface-primary p-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-semibold text-text-primary">
                                    {project.name}
                                  </h5>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      project.status === 'completed'
                                        ? 'bg-green-100 text-green-700'
                                        : project.status === 'in-progress'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {project.status}
                                  </span>
                                </div>
                                <div className="mt-2 w-full rounded-full bg-gray-200">
                                  <div
                                    className="h-1.5 rounded-full bg-green-500"
                                    style={{ width: `${project.progress}%` }}
                                  />
                                </div>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {project.progress}% complete
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Support Ticket Info */}
                  {workflowResult.data.ticket && (
                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                      <h4 className="mb-3 text-sm font-semibold text-text-primary">
                        Ticket Created
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-blue-100 px-3 py-1 font-mono text-sm font-bold text-blue-700">
                            {workflowResult.data.ticket.id}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              workflowResult.data.ticket.priority === 'urgent'
                                ? 'bg-red-100 text-red-700'
                                : workflowResult.data.ticket.priority === 'high'
                                  ? 'bg-orange-100 text-orange-700'
                                  : workflowResult.data.ticket.priority === 'medium'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {workflowResult.data.ticket.priority} priority
                          </span>
                        </div>
                        <div>
                          <h5 className="font-semibold text-text-primary">
                            {workflowResult.data.ticket.subject}
                          </h5>
                          <p className="mt-1 text-sm text-text-secondary">
                            {workflowResult.data.ticket.description}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-text-secondary">Status</p>
                            <p className="font-medium text-text-primary">
                              {workflowResult.data.ticket.status}
                            </p>
                          </div>
                          <div>
                            <p className="text-text-secondary">Assigned To</p>
                            <p className="font-medium text-text-primary">
                              {workflowResult.data.ticket.assignedTo}
                            </p>
                          </div>
                          <div>
                            <p className="text-text-secondary">Created</p>
                            <p className="font-medium text-text-primary">
                              {new Date(workflowResult.data.ticket.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-text-secondary">Response Time</p>
                            <p className="font-medium text-text-primary">
                              {workflowResult.data.ticket.estimatedResponseTime}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contact Info */}
                  {workflowResult.data.contactInfo && (
                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                      <h4 className="mb-3 text-sm font-semibold text-text-primary">
                        Contact Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 text-text-secondary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="text-text-secondary">
                            {workflowResult.data.contactInfo.email}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 text-text-secondary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                          <span className="text-text-secondary">
                            {workflowResult.data.contactInfo.phone}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 text-text-secondary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-text-secondary">
                            {workflowResult.data.contactInfo.hours}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Raw Data (Collapsible) */}
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
