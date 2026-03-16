import React, { useState } from 'react';
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useDivineEvents, useDivineEventStats } from '~/data-provider/divine-queries';
import type { DivinEvent } from '~/data-provider/divine';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTrigger(trigger: string): string {
  return trigger
    .replace(/^(cron|event):/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/:/g, ' › ')
    .trim();
}

function EventRow({ event }: { event: DivinEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {event.success ? (
            <CheckCircle size={15} className="text-green-500" />
          ) : (
            <XCircle size={15} className="text-red-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
              {formatTrigger(event.trigger)}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {event.duration && (
                <span className="text-xs text-gray-400">{event.duration}ms</span>
              )}
              <span className="text-xs text-gray-400">{timeAgo(event.createdAt)}</span>
            </div>
          </div>

          {/* Expanded: show prompt/response/error */}
          {expanded && (
            <div className="mt-2 space-y-2">
              {event.prompt && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Prompt</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded p-2 line-clamp-4">
                    {event.prompt}
                  </p>
                </div>
              )}
              {event.response && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Response</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded p-2 line-clamp-4">
                    {event.response}
                  </p>
                </div>
              )}
              {event.error && (
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2">
                  {event.error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Stats widget — small summary card for CEO dashboard.
 */
export function DivineActivityStats() {
  const { data: stats, isLoading } = useDivineEventStats();

  if (isLoading || !stats) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={16} className="text-purple-500" />
        <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Autonomous Activity</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.last24h}</p>
          <p className="text-xs text-gray-400">Actions (24h)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.total}</p>
          <p className="text-xs text-gray-400">Total</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${stats.failures > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {stats.failures}
          </p>
          <p className="text-xs text-gray-400">Failures (24h)</p>
        </div>
      </div>

      {stats.latest && (
        <p className="text-xs text-gray-400 mt-3 truncate">
          Last: {formatTrigger(stats.latest.trigger)} · {timeAgo(stats.latest.createdAt)}
        </p>
      )}
    </div>
  );
}

/**
 * Full activity log — for CEO-only settings/activity page.
 */
export default function DivineActivityLog() {
  const [page, setPage] = useState(1);
  const [successFilter, setSuccessFilter] = useState<boolean | undefined>(undefined);
  const limit = 25;

  const { data, isLoading } = useDivineEvents({ limit, page, success: successFilter });
  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-purple-500" />
          <h2 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Autonomous Activity Log</h2>
          {total > 0 && (
            <span className="text-xs text-gray-400">({total} actions)</span>
          )}
        </div>

        {/* Filter */}
        <div className="flex gap-1">
          {[
            { label: 'All', value: undefined },
            { label: 'Success', value: true },
            { label: 'Failed', value: false },
          ].map((f) => (
            <button
              key={String(f.label)}
              onClick={() => { setSuccessFilter(f.value); setPage(1); }}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                successFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events list */}
      {isLoading ? (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse">
              <div className="flex gap-3">
                <div className="w-3.5 h-3.5 mt-0.5 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-gray-400">
          No autonomous actions yet.
        </div>
      ) : (
        <div>
          {events.map((event) => (
            <EventRow key={event._id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
