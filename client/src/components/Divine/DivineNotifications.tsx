import React, { useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useDivineNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '~/data-provider/divine-queries';
import type { DivineNotification } from '~/data-provider/divine';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationItem({ n }: { n: DivineNotification }) {
  const markRead = useMarkNotificationRead();

  return (
    <div
      className={`flex gap-3 px-4 py-3 transition-colors ${
        n.read
          ? 'opacity-60'
          : 'bg-blue-50/40 dark:bg-blue-900/10 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20'
      }`}
      onClick={() => {
        if (!n.read) markRead.mutate(n._id);
      }}
    >
      {/* Unread dot */}
      <div className="mt-1.5 shrink-0">
        {n.read ? (
          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug">{n.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
          {n.refType && (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
              {n.refType.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DivineNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const { data } = useDivineNotifications();
  const markAll = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => <NotificationItem key={n._id} n={n} />)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
