'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import { supabase, Task, Submission } from '@/lib/supabase';
import {
  getTodayIST,
  formatISTDisplayDate,
  generate365Days,
  getDaysElapsed,
  formatMonthYear,
} from '@/lib/date';

interface MonthGroup {
  monthKey: string;
  year: number;
  monthIndex: number;
  label: string;
  firstDayOffset: number;
  days: {
    date: string;
    dayNum: number;
  }[];
}

function CalendarContent() {
  const { user } = useAuth();
  const [todayDate] = useState(() => getTodayIST());

  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected day detail panel
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch all tasks and user's submissions in exactly 2 queries
  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      if (!user) return;
      setError(null);

      try {
        // Query 1: All tasks assigned to user or unassigned, ordered by date ascending
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .or(`assigned_to.is.null,assigned_to.eq.${user.id}`)
          .order('date', { ascending: true });

        if (tasksError) throw tasksError;

        // Query 2: All submissions for this user
        const { data: subsData, error: subsError } = await supabase
          .from('submissions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true });

        if (subsError) throw subsError;

        if (!ignore) {
          setTasks(tasksData || []);
          setSubmissions(subsData || []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to load calendar data.';
          setError(msg);
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      ignore = true;
    };
  }, [user]);

  // Start date = earliest date in tasks, or today if no tasks
  const startDate = useMemo(() => {
    if (tasks.length > 0 && tasks[0].date) {
      return tasks[0].date;
    }
    return todayDate;
  }, [tasks, todayDate]);

  // Map tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return map;
  }, [tasks]);

  // Map submissions by date
  const submissionsByDate = useMemo(() => {
    const map: Record<string, Submission> = {};
    for (const s of submissions) {
      map[s.date] = s;
    }
    return map;
  }, [submissions]);

  // 365 consecutive days starting from startDate
  const all365Days = useMemo(() => {
    return generate365Days(startDate);
  }, [startDate]);

  // Days elapsed since start date (inclusive)
  const daysElapsed = useMemo(() => {
    return getDaysElapsed(startDate, todayDate);
  }, [startDate, todayDate]);

  // Streak: consecutive approved days ending today (if today isn't approved yet, count up to yesterday)
  const currentStreak = useMemo(() => {
    const [y, m, d] = todayDate.split('-').map(Number);
    const todayApproved = submissionsByDate[todayDate]?.status === 'approved';
    const startOffset = todayApproved ? 0 : 1;
    let streak = 0;

    for (let i = 0; i < 365; i++) {
      const dt = new Date(Date.UTC(y, m - 1, d - startOffset - i));
      const iso = dt.toISOString().split('T')[0];
      if (iso < startDate) break;

      if (submissionsByDate[iso]?.status === 'approved') {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [todayDate, submissionsByDate, startDate]);

  // Counts of approved, pending, and missed days
  const { approvedCount, missedCount } = useMemo(() => {
    let approved = 0;
    let missed = 0;

    const [y, m, d] = startDate.split('-').map(Number);
    for (let i = 0; i < daysElapsed; i++) {
      const dt = new Date(Date.UTC(y, m - 1, d + i));
      const iso = dt.toISOString().split('T')[0];
      const sub = submissionsByDate[iso];
      const dayTasks = tasksByDate[iso] || [];

      if (sub?.status === 'approved') {
        approved++;
      } else if (sub?.status === 'rejected' || (iso < todayDate && dayTasks.length > 0 && !sub)) {
        missed++;
      }
    }

    return { approvedCount: approved, missedCount: missed };
  }, [startDate, todayDate, daysElapsed, submissionsByDate, tasksByDate]);

  // Completion percentage
  const completionPercent = useMemo(() => {
    if (daysElapsed <= 0) return 0;
    return Math.round((approvedCount / daysElapsed) * 100);
  }, [approvedCount, daysElapsed]);

  // Group 365 days into month buckets
  const monthGroups: MonthGroup[] = useMemo(() => {
    const groups: Record<string, MonthGroup> = {};

    for (const dateStr of all365Days) {
      const [year, month, dayNum] = dateStr.split('-').map(Number);
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;

      if (!groups[monthKey]) {
        const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const dayOfWeekMonStart = (firstOfMonth.getUTCDay() + 6) % 7;

        groups[monthKey] = {
          monthKey,
          year,
          monthIndex: month - 1,
          label: formatMonthYear(year, month - 1),
          firstDayOffset: dayOfWeekMonStart,
          days: [],
        };
      }

      groups[monthKey].days.push({
        date: dateStr,
        dayNum,
      });
    }

    return Object.values(groups);
  }, [all365Days]);

  // Helper to determine day status and styling
  const getDayMeta = useCallback(
    (dateStr: string) => {
      const isFuture = dateStr > todayDate;
      const isToday = dateStr === todayDate;
      const sub = submissionsByDate[dateStr];
      const dayTasks = tasksByDate[dateStr] || [];

      if (isFuture) {
        return {
          status: 'future' as const,
          label: 'Future date',
          classes:
            'border border-[#2F353D] bg-transparent text-[#9AA3AE]/40 hover:border-[#3E4550]',
        };
      }

      if (sub?.status === 'approved') {
        return {
          status: 'approved' as const,
          label: 'Approved',
          classes: 'bg-[#34C759] text-[#14171B] font-bold hover:brightness-110 shadow-xs',
        };
      }

      if (sub?.status === 'pending') {
        return {
          status: 'pending' as const,
          label: 'Pending review',
          classes: 'bg-[#FFB020] text-[#14171B] font-bold hover:brightness-110 shadow-xs',
        };
      }

      if (sub?.status === 'rejected' || (dateStr < todayDate && dayTasks.length > 0 && !sub)) {
        return {
          status: 'rejected' as const,
          label: sub?.status === 'rejected' ? 'Rejected' : 'Missed',
          classes: 'bg-[#FF3B30] text-white font-bold hover:brightness-110 shadow-xs',
        };
      }

      // Past day with no submission yet
      return {
        status: 'past_empty' as const,
        label: isToday ? 'Today (Awaiting submission)' : 'No submission',
        classes: 'bg-[#252A31] text-[#9AA3AE] border border-[#2F353D]/50 hover:bg-[#2C323B]',
      };
    },
    [todayDate, submissionsByDate, tasksByDate]
  );

  // Day selection handler
  const handleSelectDay = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const selectedSub = selectedDate ? submissionsByDate[selectedDate] : null;
  const selectedTasks = selectedDate ? tasksByDate[selectedDate] || [] : [];
  const selectedMeta = selectedDate ? getDayMeta(selectedDate) : null;

  return (
    <DashboardShell
      searchPlaceholder="Filter calendar..."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-[11px] tracking-[0.25em] font-semibold text-[#9AA3AE] uppercase block">
              ANNUAL TIMELINE
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-light text-[#D9DEE5] tracking-tight">
              365-Day Calendar
            </h1>
          </div>
          <span className="text-xs text-[#9AA3AE]">
            Tracking from {formatISTDisplayDate(startDate)} to today
          </span>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-28 w-full rounded-[18px]" />
            <Skeleton className="h-96 w-full rounded-[18px]" />
          </div>
        ) : error ? (
          <Toast type="error" message={error} />
        ) : (
          <>
            {/* Top 4 Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {/* Streak */}
              <Card stagger={1} className="flex flex-col items-center justify-center text-center p-5">
                <div className="flex items-center gap-1.5 mb-1 text-[11px] font-medium tracking-wide uppercase text-[#9AA3AE]">
                  <span>Current Streak</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]" />
                </div>
                <p className="font-serif text-4xl sm:text-5xl font-light text-[#D9DEE5]">
                  {currentStreak}
                </p>
                <span className="text-[11px] text-[#9AA3AE] mt-1">consecutive days</span>
              </Card>

              {/* Completion Rate */}
              <Card stagger={1} className="flex flex-col items-center justify-center text-center p-5">
                <span className="mb-1 text-[11px] font-medium tracking-wide uppercase text-[#9AA3AE]">
                  Completion Rate
                </span>
                <p className="font-serif text-4xl sm:text-5xl font-light text-[#D9DEE5]">
                  {completionPercent}%
                </p>
                <span className="text-[11px] text-[#9AA3AE] mt-1">
                  {approvedCount} of {daysElapsed} days
                </span>
              </Card>

              {/* Approved Days */}
              <Card stagger={2} className="flex flex-col items-center justify-center text-center p-5">
                <span className="mb-1 text-[11px] font-medium tracking-wide uppercase text-[#34C759]">
                  Approved Days
                </span>
                <p className="font-serif text-4xl sm:text-5xl font-light text-[#34C759]">
                  {approvedCount}
                </p>
                <span className="text-[11px] text-[#9AA3AE] mt-1">verified submissions</span>
              </Card>

              {/* Missed Days */}
              <Card stagger={2} className="flex flex-col items-center justify-center text-center p-5">
                <span className="mb-1 text-[11px] font-medium tracking-wide uppercase text-[#FF3B30]">
                  Missed Days
                </span>
                <p className="font-serif text-4xl sm:text-5xl font-light text-[#FF3B30]">
                  {missedCount}
                </p>
                <span className="text-[11px] text-[#9AA3AE] mt-1">unverified days</span>
              </Card>
            </div>

            {/* 365-Day Grid in Wide Card */}
            <Card stagger={3} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2F353D]">
                <div>
                  <span className="text-[10px] tracking-[0.2em] font-semibold text-[#9AA3AE] uppercase block mb-0.5">
                    OVERVIEW
                  </span>
                  <h2 className="font-serif text-2xl font-light text-[#D9DEE5]">
                    Annual Grid View
                  </h2>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#9AA3AE]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#34C759]" />
                    <span>Approved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#FFB020]" />
                    <span>Pending</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#FF3B30]" />
                    <span>Missed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#252A31] border border-[#2F353D]" />
                    <span>No submission</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs border border-[#2F353D]" />
                    <span>Future</span>
                  </div>
                </div>
              </div>

              {/* Month Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {monthGroups.map((month) => (
                  <div
                    key={month.monthKey}
                    className="p-4 rounded-xl bg-[#252A31]/50 border border-[#2F353D] space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-[#D9DEE5]">
                      <span>{month.label}</span>
                      <span className="text-[10px] text-[#9AA3AE] font-normal">
                        {month.days.length} days
                      </span>
                    </div>

                    {/* Day Headers (Mon-Sun) */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#9AA3AE] font-medium">
                      <span>M</span>
                      <span>T</span>
                      <span>W</span>
                      <span>T</span>
                      <span>F</span>
                      <span>S</span>
                      <span>S</span>
                    </div>

                    {/* Grid of rounded squares */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {Array.from({ length: month.firstDayOffset }).map((_, i) => (
                        <div key={`offset-${i}`} className="w-full aspect-square" />
                      ))}

                      {month.days.map((day) => {
                        const meta = getDayMeta(day.date);
                        const isSelected = selectedDate === day.date;
                        const isToday = day.date === todayDate;

                        return (
                          <button
                            key={day.date}
                            type="button"
                            onClick={() => handleSelectDay(day.date)}
                            title={`${day.date}: ${meta.label}`}
                            className={`w-full aspect-square rounded-md text-[10px] flex items-center justify-center transition-all duration-150 cursor-pointer select-none relative ${
                              meta.classes
                            } ${
                              isSelected
                                ? 'ring-2 ring-[#FF3B30] ring-offset-1 ring-offset-[#1C1F24] scale-105 z-10'
                                : 'hover:scale-110'
                            }`}
                          >
                            <span>{day.dayNum}</span>
                            {isToday && (
                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_4px_#FF3B30]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* Day Details Modal */}
        <Modal
          isOpen={!!selectedDate}
          onClose={() => setSelectedDate(null)}
          eyebrow={selectedDate ? formatISTDisplayDate(selectedDate) : ''}
          title="Shift Day Details"
          maxWidth="max-w-md"
        >
          {selectedDate && selectedMeta && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#2F353D]">
                <span className="text-xs text-[#9AA3AE]">Verification Status</span>
                <Badge status={selectedMeta.status} label={selectedMeta.label} />
              </div>

              {/* Read-only Task List from submission or scheduled tasks */}
              {selectedSub?.task_status && selectedSub.task_status.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-wider uppercase font-semibold text-[#9AA3AE] block">
                      Submitted Tasks ({selectedSub.task_status.length})
                    </span>
                    <span className="text-xs text-[#9AA3AE] font-medium px-2 py-0.5 rounded-full bg-[#252A31] border border-[#2F353D]">
                      {selectedSub.task_status.filter((t) => t.done).length} of{' '}
                      {selectedSub.task_status.length} done
                    </span>
                  </div>

                  <ul className="space-y-2.5">
                    {selectedSub.task_status.map((item) => (
                      <li
                        key={item.task_id}
                        className="p-3 rounded-xl bg-[#252A31] border border-[#2F353D] space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`w-4 h-4 min-w-4 min-h-4 rounded-full flex items-center justify-center text-[10px] mt-0.5 ${
                                item.done
                                  ? 'bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/40'
                                  : 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40'
                              }`}
                            >
                              {item.done ? '✓' : '✕'}
                            </span>
                            <span className="text-xs text-[#D9DEE5] font-medium">{item.title}</span>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              item.done
                                ? 'bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/30'
                                : 'bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/30'
                            }`}
                          >
                            {item.done ? 'Done' : 'Not done'}
                          </span>
                        </div>

                        {!item.done && item.reason && (
                          <div className="pl-6 pt-0.5">
                            <div className="p-2.5 rounded-lg bg-[#1C1F24] border-l-2 border-[#FF3B30] text-xs text-[#9AA3AE] italic">
                              <span className="not-italic font-semibold text-[10px] text-[#D9DEE5] block mb-0.5">
                                Reason for incomplete:
                              </span>
                              &ldquo;{item.reason}&rdquo;
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : selectedTasks.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-wider uppercase font-semibold text-[#9AA3AE] block">
                      Assigned Shift Tasks ({selectedTasks.length})
                    </span>
                    <span className="text-xs text-[#9AA3AE] italic">
                      {selectedSub ? 'Submitted without task details' : 'Not submitted'}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {selectedTasks.map((task) => (
                      <li
                        key={task.id}
                        className="text-xs text-[#D9DEE5] p-2.5 rounded-lg bg-[#252A31] border border-[#2F353D] flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9AA3AE]" />
                        <span>{task.title}</span>
                      </li>
                    ))}
                  </ul>
                  {!selectedSub && (
                    <p className="text-xs text-[#9AA3AE] italic pt-1">
                      No submission was recorded for this date.
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-xs text-[#9AA3AE] italic">
                    {selectedSub
                      ? 'No task details recorded for this submission.'
                      : 'No shift tasks or submission recorded for this date.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </DashboardShell>
  );
}

export default function CalendarPage() {
  return (
    <AuthGuard>
      <CalendarContent />
    </AuthGuard>
  );
}
