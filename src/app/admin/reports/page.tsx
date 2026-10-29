'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { supabase, Profile, Task, Submission } from '@/lib/supabase';
import {
  getTodayIST,
  formatMonthYear,
  getMonthDays,
  getDaysElapsed,
} from '@/lib/date';

interface TeammateStats {
  teammate: Profile;
  overallApproved: number;
  totalDaysElapsed: number;
  completionPercent: number;
  streak: number;
  monthApproved: number;
  monthPending: number;
  monthRejected: number;
  monthMissed: number;
  monthTasksNotDone: number;
}

function ReportsContent() {
  const [todayDate] = useState(() => getTodayIST());

  // Month navigation for monthly counts
  const [currentYear, setCurrentYear] = useState(() => {
    const [y] = getTodayIST().split('-').map(Number);
    return y;
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const [, m] = getTodayIST().split('-').map(Number);
    return m;
  });

  // Search filter and notification count
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  // Data states from exactly 3 queries
  const [teammates, setTeammates] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch profiles, tasks, and submissions in THREE queries total
  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setError(null);

      try {
        // Query 1: Teammate profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email, role')
          .eq('role', 'teammate')
          .order('name', { ascending: true });

        if (profilesError) throw profilesError;

        // Query 2: All tasks to determine earliest task date & assignees
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('id, date, title, assigned_to')
          .order('date', { ascending: true });

        if (tasksError) throw tasksError;

        // Query 3: All submissions
        const { data: subsData, error: subsError } = await supabase
          .from('submissions')
          .select('id, user_id, date, status, task_status');

        if (subsError) throw subsError;

        if (!ignore) {
          setTeammates(profilesData || []);
          setTasks(tasksData || []);
          setSubmissions(subsData || []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to load report data.';
          setError(msg);
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  // Load pending submissions count for shell notification badge
  useEffect(() => {
    async function loadPendingCount() {
      try {
        const { count } = await supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (count !== null) setPendingCount(count);
      } catch {
        // ignore
      }
    }
    loadPendingCount();
  }, []);

  // Earliest date in tasks (or today if none)
  const earliestDate = useMemo(() => {
    if (tasks.length > 0 && tasks[0].date) {
      return tasks[0].date;
    }
    return todayDate;
  }, [tasks, todayDate]);

  // Total days elapsed since earliest task date up to today (IST)
  const totalDaysElapsed = useMemo(() => {
    return getDaysElapsed(earliestDate, todayDate);
  }, [earliestDate, todayDate]);

  // Days in selected filter month
  const monthDays = useMemo(() => {
    return getMonthDays(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Index tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return map;
  }, [tasks]);

  // Index submissions by user_id and date
  const submissionsMap = useMemo(() => {
    const map: Record<string, Record<string, Submission>> = {};
    for (const s of submissions) {
      if (!map[s.user_id]) map[s.user_id] = {};
      map[s.user_id][s.date] = s;
    }
    return map;
  }, [submissions]);

  // Calculate statistics per teammate and sort leaderboard
  const leaderboard: TeammateStats[] = useMemo(() => {
    const stats: TeammateStats[] = teammates.map((tm) => {
      const userSubs = submissionsMap[tm.id] || {};

      // 1. Overall Approved Days since earliestDate
      let overallApproved = 0;
      const [ey, em, ed] = earliestDate.split('-').map(Number);
      for (let i = 0; i < totalDaysElapsed; i++) {
        const dt = new Date(Date.UTC(ey, em - 1, ed + i));
        const iso = dt.toISOString().split('T')[0];
        if (userSubs[iso]?.status === 'approved') {
          overallApproved++;
        }
      }

      const completionPercent =
        totalDaysElapsed > 0 ? Math.round((overallApproved / totalDaysElapsed) * 100) : 0;

      // 2. Current Streak: consecutive approved days ending today (if today isn't approved yet, count up to yesterday)
      const [ty, tmonth, td] = todayDate.split('-').map(Number);
      const todayApproved = userSubs[todayDate]?.status === 'approved';
      const startOffset = todayApproved ? 0 : 1;
      let streak = 0;

      for (let i = 0; i < 365; i++) {
        const dt = new Date(Date.UTC(ty, tmonth - 1, td - startOffset - i));
        const iso = dt.toISOString().split('T')[0];
        if (iso < earliestDate) break;

        if (userSubs[iso]?.status === 'approved') {
          streak++;
        } else {
          break;
        }
      }

      // 3. Month Filter counts: approved, pending, rejected, missed, tasks not done
      let monthApproved = 0;
      let monthPending = 0;
      let monthRejected = 0;
      let monthMissed = 0;
      let monthTasksNotDone = 0;

      for (const day of monthDays) {
        const date = day.date;
        const sub = userSubs[date];
        const dayTasks = (tasksByDate[date] || []).filter(
          (t) => t.assigned_to === null || t.assigned_to === tm.id
        );

        if (sub?.status === 'approved') {
          monthApproved++;
        } else if (sub?.status === 'pending') {
          monthPending++;
        } else if (sub?.status === 'rejected') {
          monthRejected++;
        } else if (date < todayDate && dayTasks.length > 0 && !sub) {
          // Past date with tasks but no submission = missed
          monthMissed++;
        }

        if (sub?.task_status && Array.isArray(sub.task_status)) {
          for (const item of sub.task_status) {
            if (!item.done) {
              monthTasksNotDone++;
            }
          }
        }
      }

      return {
        teammate: tm,
        overallApproved,
        totalDaysElapsed,
        completionPercent,
        streak,
        monthApproved,
        monthPending,
        monthRejected,
        monthMissed,
        monthTasksNotDone,
      };
    });

    // Sort leaderboard by completion %, then by streak descending
    return stats.sort((a, b) => {
      if (b.completionPercent !== a.completionPercent) {
        return b.completionPercent - a.completionPercent;
      }
      return b.streak - a.streak;
    });
  }, [
    teammates,
    submissionsMap,
    tasksByDate,
    earliestDate,
    todayDate,
    totalDaysElapsed,
    monthDays,
  ]);

  // Filter leaderboard by search query
  const filteredLeaderboard = useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;
    const q = searchQuery.toLowerCase().trim();
    return leaderboard.filter(
      (row) =>
        (row.teammate.name && row.teammate.name.toLowerCase().includes(q)) ||
        (row.teammate.email && row.teammate.email.toLowerCase().includes(q))
    );
  }, [leaderboard, searchQuery]);

  // Overall aggregate summaries
  const avgCompletion = useMemo(() => {
    if (leaderboard.length === 0) return 0;
    const sum = leaderboard.reduce((acc, cur) => acc + cur.completionPercent, 0);
    return Math.round(sum / leaderboard.length);
  }, [leaderboard]);

  const maxStreak = useMemo(() => {
    if (leaderboard.length === 0) return 0;
    return Math.max(...leaderboard.map((t) => t.streak));
  }, [leaderboard]);

  const totalMonthApproved = useMemo(() => {
    return leaderboard.reduce((acc, cur) => acc + cur.monthApproved, 0);
  }, [leaderboard]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  return (
    <DashboardShell
      searchPlaceholder="Filter leaderboard by teammate..."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      pendingCount={pendingCount}
    >
      <div className="space-y-8">
        {/* Header & Month Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] tracking-[0.25em] font-medium text-[#9AA3AE] uppercase block">
              ANALYTICS & METRICS
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-light text-[#D9DEE5] tracking-tight">
              Team Performance
            </h1>
          </div>

          {/* Month Selector with rounded pill container */}
          <div className="flex items-center gap-3 self-start sm:self-auto bg-[#252A31] border border-[#2F353D] p-1.5 rounded-full">
            <Button
              variant="icon"
              size="sm"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
            >
              <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Button>
            <span className="text-xs font-semibold text-[#D9DEE5] min-w-[120px] text-center">
              {formatMonthYear(currentYear, currentMonth - 1)}
            </span>
            <Button
              variant="icon"
              size="sm"
              onClick={handleNextMonth}
              aria-label="Next Month"
            >
              <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-[18px]" />
            <Skeleton className="h-96 w-full rounded-[18px]" />
          </div>
        ) : error ? (
          <Toast type="error" message={error} />
        ) : (
          <>
            {/* 3 Summary Stats separated by thin lines */}
            <Card stagger={1} className="!p-0 overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#2F353D] text-center">
                <div className="p-6 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-medium tracking-wide uppercase text-[#9AA3AE] mb-1">
                    Avg Completion Rate
                  </span>
                  <p className="font-serif text-4xl sm:text-5xl font-light text-[#D9DEE5]">
                    {avgCompletion}%
                  </p>
                  <span className="text-[11px] text-[#9AA3AE] mt-1">across all teammates</span>
                </div>

                <div className="p-6 flex flex-col items-center justify-center">
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-medium tracking-wide uppercase text-[#9AA3AE]">
                    <span>Highest Streak</span>
                    <span className="w-2 h-2 rounded-full bg-[#FF3B30] shadow-[0_0_8px_#FF3B30]" />
                  </div>
                  <p className="font-serif text-4xl sm:text-5xl font-light text-[#D9DEE5]">
                    {maxStreak}
                  </p>
                  <span className="text-[11px] text-[#9AA3AE] mt-1">consecutive days</span>
                </div>

                <div className="p-6 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-medium tracking-wide uppercase text-[#34C759] mb-1">
                    Monthly Approvals
                  </span>
                  <p className="font-serif text-4xl sm:text-5xl font-light text-[#34C759]">
                    {totalMonthApproved}
                  </p>
                  <span className="text-[11px] text-[#9AA3AE] mt-1">
                    for {formatMonthYear(currentYear, currentMonth - 1)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Leaderboard Table Card */}
            <Card stagger={2} className="space-y-6">
              <div className="border-b border-[#2F353D] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] tracking-[0.2em] font-medium text-[#9AA3AE] uppercase block mb-1">
                    STANDINGS
                  </span>
                  <h2 className="font-serif text-2xl font-light text-[#D9DEE5]">
                    Consistency Leaderboard
                  </h2>
                </div>
                <span className="text-xs text-[#9AA3AE]">
                  Sorted by completion %, then streak
                </span>
              </div>

              {filteredLeaderboard.length === 0 ? (
                <EmptyState
                  title={searchQuery ? 'No matching teammates' : 'No teammate data'}
                  description={
                    searchQuery
                      ? `No teammates matching "${searchQuery}".`
                      : 'Register teammates and record daily shifts to populate the leaderboard.'
                  }
                />
              ) : (
                <>
                  {/* Desktop Table with Thin Row Dividers */}
                  <div className="hidden md:block overflow-x-auto rounded-[14px] border border-[#2F353D] bg-[#14171B]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#252A31] border-b border-[#2F353D] text-[11px] font-medium tracking-wide uppercase text-[#9AA3AE]">
                        <tr>
                          <th className="p-3.5 w-16 text-center">Rank</th>
                          <th className="p-3.5">Teammate</th>
                          <th className="p-3.5 min-w-[200px]">Overall Completion</th>
                          <th className="p-3.5 text-center">Streak</th>
                          <th className="p-3.5 text-center text-[#34C759]">Appr.</th>
                          <th className="p-3.5 text-center text-[#FFB020]">Pend.</th>
                          <th className="p-3.5 text-center text-[#FF3B30]">Rej.</th>
                          <th className="p-3.5 text-center text-[#9AA3AE]">Missed</th>
                          <th className="p-3.5 text-center text-[#FF3B30]">Tasks not done</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2F353D]">
                        {filteredLeaderboard.map((row, idx) => {
                          const initial = (row.teammate.name || row.teammate.email || '?')
                            .charAt(0)
                            .toUpperCase();

                          return (
                            <tr key={row.teammate.id} className="hover:bg-[#252A31]/40 transition-colors">
                              {/* Large Serif Rank */}
                              <td className="p-3.5 text-center font-serif text-xl sm:text-2xl font-light text-[#D9DEE5]">
                                <span className="flex items-center justify-center gap-1.5">
                                  #{idx + 1}
                                  {idx === 0 && (
                                    <span className="w-2 h-2 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]" />
                                  )}
                                </span>
                              </td>

                              <td className="p-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#252A31] border border-[#2F353D] flex items-center justify-center font-medium text-xs text-[#D9DEE5]">
                                    {initial}
                                  </div>
                                  <div>
                                    <span className="font-medium text-sm text-[#D9DEE5] block">
                                      {row.teammate.name || 'Unnamed teammate'}
                                    </span>
                                    <span className="text-[11px] text-[#9AA3AE] font-mono">
                                      {row.teammate.email || '—'}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Thin Progress Line */}
                              <td className="p-3.5">
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-[11px]">
                                    <span className="font-medium text-[#D9DEE5]">
                                      {row.completionPercent}%
                                    </span>
                                    <span className="text-[#9AA3AE]">
                                      {row.overallApproved} / {row.totalDaysElapsed} d
                                    </span>
                                  </div>
                                  <ProgressBar value={row.completionPercent} />
                                </div>
                              </td>

                              <td className="p-3.5 text-center">
                                <span className="font-serif text-lg font-light text-[#D9DEE5]">
                                  {row.streak}
                                </span>
                                <span className="text-[10px] text-[#9AA3AE] block">days</span>
                              </td>

                              <td className="p-3.5 text-center font-medium text-[#34C759]">
                                {row.monthApproved}
                              </td>

                              <td className="p-3.5 text-center font-medium text-[#FFB020]">
                                {row.monthPending}
                              </td>

                              <td className="p-3.5 text-center font-medium text-[#FF3B30]">
                                {row.monthRejected}
                              </td>

                              <td className="p-3.5 text-center text-[#9AA3AE]">
                                {row.monthMissed}
                              </td>

                              <td className="p-3.5 text-center font-medium text-[#FF3B30]">
                                {row.monthTasksNotDone}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Stacked Dark Cards */}
                  <div className="md:hidden space-y-4">
                    {filteredLeaderboard.map((row, idx) => {
                      const initial = (row.teammate.name || row.teammate.email || '?')
                        .charAt(0)
                        .toUpperCase();

                      return (
                        <div
                          key={row.teammate.id}
                          className="p-5 rounded-xl bg-[#252A31] border border-[#2F353D] space-y-3.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-serif text-2xl font-light text-[#D9DEE5] flex items-center gap-1">
                                #{idx + 1}
                                {idx === 0 && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]" />
                                )}
                              </span>
                              <div className="w-8 h-8 rounded-full bg-[#1C1F24] border border-[#2F353D] flex items-center justify-center font-medium text-xs text-[#D9DEE5]">
                                {initial}
                              </div>
                              <div>
                                <span className="font-medium text-sm text-[#D9DEE5] block leading-tight">
                                  {row.teammate.name || 'Unnamed teammate'}
                                </span>
                                <span className="text-[10px] text-[#9AA3AE] font-mono">
                                  {row.teammate.email}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="font-serif text-lg font-light text-[#D9DEE5] block leading-none">
                                {row.streak} d
                              </span>
                              <span className="text-[10px] text-[#9AA3AE]">streak</span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-[#D9DEE5]">
                                Overall: {row.completionPercent}%
                              </span>
                              <span className="text-[#9AA3AE]">
                                {row.overallApproved} / {row.totalDaysElapsed} days
                              </span>
                            </div>
                            <ProgressBar value={row.completionPercent} />
                          </div>

                          {/* Month counts */}
                          <div className="grid grid-cols-5 gap-2 pt-2 border-t border-[#2F353D] text-center text-xs">
                            <div>
                              <span className="text-[10px] text-[#9AA3AE] block">Appr.</span>
                              <span className="font-medium text-[#34C759]">{row.monthApproved}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#9AA3AE] block">Pend.</span>
                              <span className="font-medium text-[#FFB020]">{row.monthPending}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#9AA3AE] block">Rej.</span>
                              <span className="font-medium text-[#FF3B30]">{row.monthRejected}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#9AA3AE] block">Missed</span>
                              <span className="font-medium text-[#9AA3AE]">{row.monthMissed}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#9AA3AE] block">Not done</span>
                              <span className="font-medium text-[#FF3B30]">{row.monthTasksNotDone}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

export default function AdminReportsPage() {
  return (
    <AuthGuard allowedRoles={['admin']}>
      <ReportsContent />
    </AuthGuard>
  );
}
