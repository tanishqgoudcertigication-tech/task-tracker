'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import { getTodayIST, formatISTDisplayDate } from '@/lib/date';

export interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
  dateStr: string;
  href: string;
  hasRedDot?: boolean;
  type: 'admin_pending' | 'unsubmitted' | 'rejected' | 'approved';
}

function getSubtractedDateIST(days: number): string {
  const today = getTodayIST();
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days));
  const sy = dt.getUTCFullYear();
  const sm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const sd = String(dt.getUTCDate()).padStart(2, '0');
  return `${sy}-${sm}-${sd}`;
}

function doneCountText(done: number, total: number): string {
  return `${done} of ${total} tasks done`;
}

export function NotificationBellDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Refreshes:
  // 1. When the page loads
  // 2. When the panel opens (via refreshKey)
  // 3. Every 60 seconds
  useEffect(() => {
    if (!user) return;

    const currentUserId = user.id;
    let active = true;

    async function loadNotifications() {
      try {
        const todayIST = getTodayIST();

        if (isAdmin) {
          // Admin: list every submission with status 'pending' (newest first, up to 20)
          const { data: subsData, error: subsErr } = await supabase
            .from('submissions')
            .select('id, user_id, date, status, task_status, profiles:user_id(id, name, email)')
            .eq('status', 'pending')
            .order('date', { ascending: false })
            .limit(20);

          if (subsErr) throw subsErr;
          if (!active) return;

          const newItems: NotificationItem[] = (subsData || []).map((sub) => {
            const profileData = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
            const teammateName = profileData?.name || profileData?.email || 'Teammate';

            const tasks = Array.isArray(sub.task_status) ? sub.task_status : [];
            const totalTasks = tasks.length;
            const doneTasks = tasks.filter((t: { done?: boolean }) => !!t.done).length;
            const hasNotDone = tasks.some((t: { done?: boolean }) => !t.done);

            return {
              id: String(sub.id),
              title: teammateName,
              subtitle: totalTasks > 0 ? doneCountText(doneTasks, totalTasks) : 'Pending review',
              dateStr: formatISTDisplayDate(sub.date),
              href: `/admin?review=${sub.id}`,
              hasRedDot: hasNotDone,
              type: 'admin_pending',
            };
          });

          setItems(newItems);
          setError(null);
        } else {
          // Teammate: exactly one query for today's tasks and one query for submissions
          const sevenDaysAgo = getSubtractedDateIST(7);
          const threeDaysAgo = getSubtractedDateIST(3);

          const [tasksRes, subsRes] = await Promise.all([
            supabase
              .from('tasks')
              .select('id, title, date, assigned_to')
              .eq('date', todayIST)
              .or(`assigned_to.is.null,assigned_to.eq.${currentUserId}`),
            supabase
              .from('submissions')
              .select('id, user_id, date, status, task_status')
              .gte('date', sevenDaysAgo)
              .order('date', { ascending: false }),
          ]);

          if (tasksRes.error) throw tasksRes.error;
          if (subsRes.error) throw subsRes.error;
          if (!active) return;

          const tasksData = tasksRes.data || [];
          const subsData = subsRes.data || [];

          const newItems: NotificationItem[] = [];

          // 1. "Today's tasks not submitted yet" (if tasks exist for today in IST and there is no submission)
          const todaySub = subsData.find((s) => s.date === todayIST);
          if (tasksData.length > 0 && !todaySub) {
            newItems.push({
              id: 'unsubmitted-today',
              title: "Today's tasks not submitted yet",
              subtitle: `${tasksData.length} ${tasksData.length === 1 ? 'task' : 'tasks'} scheduled`,
              dateStr: formatISTDisplayDate(todayIST),
              href: '/today',
              hasRedDot: true,
              type: 'unsubmitted',
            });
          }

          // 2. "Your day was rejected, please resubmit" (rejected submissions in the last 7 days)
          subsData
            .filter((s) => s.status === 'rejected')
            .forEach((s) => {
              newItems.push({
                id: `rejected-${s.id}`,
                title: 'Your day was rejected, please resubmit',
                subtitle: `Reason required for ${formatISTDisplayDate(s.date)}`,
                dateStr: formatISTDisplayDate(s.date),
                href: s.date === todayIST ? '/today' : '/calendar',
                hasRedDot: true,
                type: 'rejected',
              });
            });

          // 3. "Approved" (approved in the last 3 days)
          subsData
            .filter((s) => s.status === 'approved' && s.date >= threeDaysAgo)
            .forEach((s) => {
              newItems.push({
                id: `approved-${s.id}`,
                title: 'Approved',
                subtitle: `Shift for ${formatISTDisplayDate(s.date)} was approved`,
                dateStr: formatISTDisplayDate(s.date),
                href: '/calendar',
                hasRedDot: false,
                type: 'approved',
              });
            });

          setItems(newItems);
          setError(null);
        }
      } catch (err: unknown) {
        if (!active) return;
        console.error('Failed to load notifications:', err);
        const msg = err instanceof Error ? err.message : 'Failed to load notifications.';
        setError(msg);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadNotifications();

    const interval = setInterval(() => {
      void loadNotifications();
    }, 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user, isAdmin, refreshKey]);

  // When panel opens: refresh data
  const handleToggle = () => {
    if (!isOpen) {
      setRefreshKey((k) => k + 1);
    }
    setIsOpen((prev) => !prev);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  // Close on Escape & trap focus inside panel
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the panel or its first focusable element
    const timer = setTimeout(() => {
      if (panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          panelRef.current.focus();
        }
      }
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  const handleRowClick = (item: NotificationItem) => {
    setIsOpen(false);

    if (item.type === 'admin_pending') {
      if (pathname === '/admin') {
        // Already on admin page: dispatch custom event to open modal immediately
        window.dispatchEvent(
          new CustomEvent('open-admin-review', { detail: { submissionId: item.id } })
        );
      } else {
        router.push(item.href);
      }
    } else {
      router.push(item.href);
    }
  };

  const badgeCount = items.length;
  const displayBadge = badgeCount > 9 ? '9+' : String(badgeCount);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications${badgeCount > 0 ? `, ${badgeCount} items` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative w-8 h-8 rounded-full bg-[#252A31] border border-[#2F353D] flex items-center justify-center text-[#9AA3AE] hover:text-[#D9DEE5] hover:border-[#3E4550] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#FF3B30]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {/* Real red badge capped at 9+, hidden when 0 */}
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FF3B30] text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_#FF3B30] pointer-events-none">
            {displayBadge}
          </span>
        )}
      </button>

      {/* Dropdown Panel: 320px wide on desktop, full width below top bar on mobile */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          aria-modal="true"
          tabIndex={-1}
          className="fixed inset-x-3 top-20 sm:top-full sm:mt-2.5 sm:inset-x-auto sm:right-0 sm:w-[320px] bg-[#1C1F24] border border-[#2F353D] border-t-2 border-t-[#FF3B30] rounded-2xl shadow-2xl p-3.5 sm:p-4 z-50 animate-in fade-in zoom-in-95 duration-150 focus:outline-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-[#2F353D]">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg font-light text-[#D9DEE5]">Notifications</h3>
              {badgeCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/30 text-[10px] font-bold">
                  {displayBadge}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-md text-[#9AA3AE] hover:text-[#D9DEE5] hover:bg-[#252A31] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close notifications"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-2">
            {loading ? (
              /* Skeleton state while loading */
              <div className="space-y-2.5 py-1">
                <div className="h-12 w-full rounded-xl bg-[#252A31] animate-pulse" />
                <div className="h-12 w-full rounded-xl bg-[#252A31] animate-pulse" />
                <div className="h-12 w-full rounded-xl bg-[#252A31] animate-pulse" />
              </div>
            ) : error ? (
              /* Error state with Retry button */
              <div className="py-6 px-3 text-center space-y-3">
                <p className="text-xs text-[#FF3B30] leading-relaxed">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setRefreshKey((k) => k + 1);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#252A31] hover:bg-[#2F353D] text-[#D9DEE5] text-xs font-medium border border-[#2F353D] transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : items.length === 0 ? (
              /* Empty state: You're all caught up with check icon */
              <div className="py-7 px-3 text-center space-y-2">
                <div className="w-9 h-9 rounded-full bg-[#34C759]/15 border border-[#34C759]/30 text-[#34C759] flex items-center justify-center mx-auto mb-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[#D9DEE5]">You&apos;re all caught up</p>
                <p className="text-[11px] text-[#9AA3AE]">No new notifications right now.</p>
              </div>
            ) : (
              /* Notification Items List */
              <ul className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1 -mr-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleRowClick(item)}
                      className="w-full text-left p-2.5 rounded-xl bg-[#252A31]/50 hover:bg-[#252A31] border border-[#2F353D]/60 hover:border-[#3E4550] transition-all flex items-start justify-between gap-2.5 group cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[#FF3B30]"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-[#D9DEE5] truncate group-hover:text-white">
                            {item.title}
                          </span>
                          {/* Signal red dot if any task was not done */}
                          {item.hasRedDot && (
                            <span
                              title="Reason given"
                              className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30] shrink-0"
                            />
                          )}
                          {item.type === 'approved' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] shadow-[0_0_6px_#34C759] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#9AA3AE] truncate">{item.subtitle}</p>
                      </div>

                      <span className="text-[10px] text-[#9AA3AE] shrink-0 whitespace-nowrap pt-0.5 font-mono">
                        {item.dateStr}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer for Admin: Review all link */}
          {isAdmin && (
            <div className="pt-3 mt-2 border-t border-[#2F353D] text-center">
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="text-xs font-medium text-[#FF3B30] hover:text-[#FF5A4F] transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Review all</span>
                <span>→</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
