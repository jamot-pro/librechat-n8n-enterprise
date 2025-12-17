import React, { useState } from 'react';
import WorkflowCard from './WorkflowCard';
import ProfileStats from './ProfileStats';
import { useToastContext } from '@librechat/client';

export default function CEODashboard({ profile }: { profile: any }) {
  const [executingWorkflow, setExecutingWorkflow] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const { showToast } = useToastContext();

  const stats = [
    {
      title: 'Total Revenue',
      value: '$2.4M',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      trend: { value: 12.5, isPositive: true },
      subtitle: 'This quarter',
    },
    {
      title: 'Active Projects',
      value: '24',
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
      trend: { value: 8.2, isPositive: true },
    },
    {
      title: 'Team Members',
      value: '142',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      trend: { value: 3.1, isPositive: true },
    },
    {
      title: 'Profit Margin',
      value: '32%',
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
      trend: { value: 2.4, isPositive: false },
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

      const payload = {
        userId: profile?.userId,
        profileType: profile?.profileType,
        workflowId: workflowId,
        permissions: profile?.permissions || [],
        metadata: profile?.metadata || {},
        timestamp: new Date().toISOString(),
      };

      console.log('[CEO Dashboard] Sending payload to n8n:', payload);
      console.log('[CEO Dashboard] Profile type:', profile?.profileType);
      console.log('[CEO Dashboard] Full URL:', `${n8nBaseUrl}${workflow?.endpoint}`);

      const response = await fetch(`${n8nBaseUrl}${workflow?.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('[CEO Dashboard] Response status:', response.status);
      console.log('[CEO Dashboard] Response headers:', response.headers.get('content-type'));

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const htmlText = await response.text();
        console.error('[CEO Dashboard] Got HTML instead of JSON:', htmlText.substring(0, 500));
        throw new Error(
          `n8n returned HTML instead of JSON. Workflow might not be activated. Status: ${response.status}`,
        );
      }

      const result = await response.json();

      setWorkflowResult({
        workflowName: workflow?.workflowName,
        status: response.ok ? 'success' : 'error',
        data: result,
        timestamp: new Date().toLocaleString(),
      });

      setShowResultModal(true);

      showToast({
        message: `${workflow?.workflowName} executed successfully!`,
        status: 'success',
      });
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
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border-light pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">CEO Dashboard</h1>
            <p className="mt-2 text-text-secondary">Executive overview and company analytics</p>
          </div>
          <div className="rounded-lg bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-600">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
              CEO Access
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <ProfileStats stats={stats} />

      {/* Workflows Section */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Available Workflows</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Execute enterprise-level workflows and analytics
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
              Contact your administrator to configure workflows for your profile.
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
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">Reports</span>
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>

            {/* Workflow Result Modal */}
            {showResultModal && workflowResult && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border border-border-light bg-surface-primary shadow-2xl">
                  {/* Modal Header */}
                  <div className="sticky top-0 border-b border-border-light bg-surface-primary-alt p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-text-primary">
                          Workflow Execution Result
                        </h3>
                        <p className="mt-1 text-sm text-text-secondary">
                          {workflowResult.workflowName}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowResultModal(false)}
                        className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
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

                  {/* Modal Body */}
                  <div className="p-6">
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
                      <span className="text-xs text-text-secondary">
                        {workflowResult.timestamp}
                      </span>
                    </div>

                    {/* Result Data */}
                    {workflowResult.status === 'success' && workflowResult.data && (
                      <div className="space-y-4">
                        {/* Summary Section */}
                        {workflowResult.data.summary && (
                          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                            <h4 className="mb-2 text-sm font-semibold text-purple-900">
                              Executive Summary
                            </h4>
                            <p className="text-sm text-purple-700">{workflowResult.data.summary}</p>
                          </div>
                        )}

                        {/* Key Insights */}
                        {workflowResult.data.insights &&
                          workflowResult.data.insights.length > 0 && (
                            <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                              <h4 className="mb-3 text-sm font-semibold text-text-primary">
                                Key Insights
                              </h4>
                              <div className="space-y-2">
                                {workflowResult.data.insights.map(
                                  (insight: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      <svg
                                        className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-500"
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
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                        {/* Financial Metrics Grid */}
                        {workflowResult.data.data && (
                          <div className="grid grid-cols-3 gap-4">
                            {/* Revenue Card */}
                            {workflowResult.data.data.revenue !== undefined && (
                              <div className="rounded-lg border border-border-light bg-gradient-to-br from-green-50 to-emerald-50 p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-medium text-green-600">Revenue</p>
                                    <p className="mt-1 text-2xl font-bold text-green-900">
                                      ${(workflowResult.data.data.revenue / 1000000).toFixed(1)}M
                                    </p>
                                    {workflowResult.data.data.growthRate !== undefined && (
                                      <p className="mt-1 text-xs text-green-700">
                                        +{workflowResult.data.data.growthRate}% growth
                                      </p>
                                    )}
                                  </div>
                                  <svg
                                    className="h-10 w-10 text-green-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}

                            {/* Expenses Card */}
                            {workflowResult.data.data.expenses !== undefined && (
                              <div className="rounded-lg border border-border-light bg-gradient-to-br from-orange-50 to-amber-50 p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-medium text-orange-600">Expenses</p>
                                    <p className="mt-1 text-2xl font-bold text-orange-900">
                                      ${(workflowResult.data.data.expenses / 1000000).toFixed(1)}M
                                    </p>
                                  </div>
                                  <svg
                                    className="h-10 w-10 text-orange-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}

                            {/* Profit Card */}
                            {workflowResult.data.data.profit !== undefined && (
                              <div className="rounded-lg border border-border-light bg-gradient-to-br from-purple-50 to-violet-50 p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-medium text-purple-600">Profit</p>
                                    <p className="mt-1 text-2xl font-bold text-purple-900">
                                      ${(workflowResult.data.data.profit / 1000000).toFixed(1)}M
                                    </p>
                                    {workflowResult.data.data.profitMargin !== undefined && (
                                      <p className="mt-1 text-xs text-purple-700">
                                        {workflowResult.data.data.profitMargin}% margin
                                      </p>
                                    )}
                                  </div>
                                  <svg
                                    className="h-10 w-10 text-purple-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Departments Performance */}
                        {workflowResult.data.data?.departments &&
                          workflowResult.data.data.departments.length > 0 && (
                            <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                              <h4 className="mb-3 text-sm font-semibold text-text-primary">
                                Department Performance
                              </h4>
                              <div className="space-y-3">
                                {workflowResult.data.data.departments.map(
                                  (dept: any, idx: number) => {
                                    // Determine primary metric for each department
                                    let primaryValue = 0;
                                    let primaryLabel = '';
                                    let secondaryInfo = '';

                                    if (dept.revenue !== undefined) {
                                      primaryValue = dept.revenue;
                                      primaryLabel = `$${(dept.revenue / 1000).toFixed(0)}K`;
                                      if (dept.profit !== undefined) {
                                        secondaryInfo = `${dept.profit >= 0 ? '+' : ''}$${(dept.profit / 1000).toFixed(0)}K profit`;
                                      }
                                    } else if (dept.budget !== undefined) {
                                      primaryValue = dept.budget;
                                      primaryLabel = `$${(dept.budget / 1000).toFixed(0)}K budget`;
                                      if (dept.spent !== undefined) {
                                        const percentUsed = (
                                          (dept.spent / dept.budget) *
                                          100
                                        ).toFixed(0);
                                        secondaryInfo = `${percentUsed}% utilized`;
                                      }
                                    } else if (dept.employees !== undefined) {
                                      primaryValue = dept.employees;
                                      primaryLabel = `${dept.employees} employees`;
                                      if (dept.productivity !== undefined) {
                                        secondaryInfo = `${dept.productivity}% productivity`;
                                      }
                                    } else {
                                      primaryValue = 100;
                                      primaryLabel = 'N/A';
                                    }

                                    // Calculate max value for progress bar
                                    const allValues = workflowResult.data.data.departments.map(
                                      (d: any) => d.revenue || d.budget || d.employees || 100,
                                    );
                                    const maxValue = Math.max(...allValues);
                                    const percentage = Math.min(
                                      100,
                                      (primaryValue / maxValue) * 100,
                                    );

                                    return (
                                      <div key={idx}>
                                        <div className="mb-1 flex items-center justify-between text-sm">
                                          <span className="font-medium text-text-primary">
                                            {dept.name}
                                          </span>
                                          <span className="text-text-secondary">
                                            {primaryLabel}
                                            {secondaryInfo && (
                                              <span className="ml-2 text-xs text-text-secondary">
                                                ({secondaryInfo})
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-surface-tertiary">
                                          <div
                                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600"
                                            style={{ width: `${percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          )}

                        {/* Top Products */}
                        {workflowResult.data.data?.topProducts &&
                          workflowResult.data.data.topProducts.length > 0 && (
                            <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                              <h4 className="mb-3 text-sm font-semibold text-text-primary">
                                Top Products
                              </h4>
                              <div className="space-y-2">
                                {workflowResult.data.data.topProducts.map(
                                  (product: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between rounded-lg bg-surface-primary p-3"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                                          {idx + 1}
                                        </div>
                                        <span className="font-medium text-text-primary">
                                          {product.name}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-semibold text-text-primary">
                                          ${(product.revenue / 1000).toFixed(0)}K
                                        </div>
                                        <div
                                          className={`text-xs ${product.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}
                                        >
                                          {product.growth >= 0 ? '+' : ''}
                                          {product.growth}% growth
                                        </div>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                        {/* Recent Transactions */}
                        {workflowResult.data.data?.monthlyTrend &&
                          workflowResult.data.data.monthlyTrend.length > 0 && (
                            <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                              <h4 className="mb-3 text-sm font-semibold text-text-primary">
                                Recent Transactions
                              </h4>
                              <div className="grid grid-cols-3 gap-3">
                                {workflowResult.data.data.monthlyTrend.map(
                                  (month: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="rounded-lg bg-surface-primary p-3 text-center"
                                    >
                                      <p className="text-xs font-medium text-text-secondary">
                                        {month.month}
                                      </p>
                                      <p className="mt-1 text-lg font-bold text-text-primary">
                                        ${(month.revenue / 1000).toFixed(0)}K
                                      </p>
                                      <p className="mt-0.5 text-xs text-green-600">
                                        ${(month.profit / 1000).toFixed(0)}K profit
                                      </p>
                                    </div>
                                  ),
                                )}
                              </div>
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
            <span className="text-xs font-medium text-text-primary">Team</span>
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
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">Alerts</span>
          </button>
        </div>
      </div>
    </div>
  );
}
