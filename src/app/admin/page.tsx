'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AuthGuard } from '@/components/auth-guard';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressBar } from '@/components/ui/progress-bar';
import { supabase, Profile, Task, Submission } from '@/lib/supabase';
import {
  getTodayIST,
  formatISTDisplayDate,
  formatMonthYear,
  getMonthDays,
} from '@/lib/date';

interface CellMeta {
  status: 'approved' | 'pending' | 'rejected' | 'missed' | 'past_empty' | 'future';
  colorClass: string;
  label: string;
  submission: Submission | null;
}

interface ReviewTarget {
  teammate: Profile;
  date: string;
  submission: Submission;
  tasks: Task[];
}

function AdminContent() {
  const [todayDate] = useState(() => getTodayIST());

  // Default to current month in IST
  const [currentYear, setCurrentYear] = useState(() => {
    const [y] = getTodayIST().split('-').map(Number);
    return y;
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const [, m] = getTodayIST().split('-').map(Number);
    return m;
  });

  // Filters & Range
  const [timeRange, setTimeRange] = useState<'1W' | '1M' | '3M' | 'All'>('1M');
  const [chartView, setChartView] = useState<'Week' | 'Month' | 'Year'>('Month');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [teammates, setTeammates] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refresh trigger for when a submission is approved/rejected
  const [refreshKey, setRefreshKey] = useState(0);

  // Review Modal state
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Month date range
  const daysInMonth = useMemo(() => {
    return getMonthDays(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  const firstDayOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const lastDayOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(
    daysInMonth.length
  ).padStart(2, '0')}`;

  // Fetch profiles, tasks, and submissions in THREE queries total
  useEffect(() => {
    let ignore = false;

    async function loadMonthData() {
      setError(null);

      try {
        // Query 1: Teammate profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, role, email')
          .eq('role', 'teammate')
          .order('name', { ascending: true });

        if (profilesError) throw profilesError;

        // Query 2: Tasks for the visible month
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .gte('date', firstDayOfMonth)
          .lte('date', lastDayOfMonth)
          .order('date', { ascending: true });

        if (tasksError) throw tasksError;

        // Query 3: Submissions for the visible month
        const { data: subsData, error: subsError } = await supabase
          .from('submissions')
          .select('*')
          .gte('date', firstDayOfMonth)
          .lte('date', lastDayOfMonth);

        if (subsError) throw subsError;

        if (!ignore) {
          setTeammates(profilesData || []);
          setTasks(tasksData || []);
          setSubmissions(subsData || []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to load month data.';
          setError(msg);
          setLoading(false);
        }
      }
    }

    loadMonthData();

    return () => {
      ignore = true;
    };
  }, [firstDayOfMonth, lastDayOfMonth, refreshKey]);

  // Index submissions by user_id and date
  const submissionsMap = useMemo(() => {
    const map: Record<string, Submission> = {};
    for (const s of submissions) {
      map[`${s.user_id}_${s.date}`] = s;
    }
    return map;
  }, [submissions]);

  // Index tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return map;
  }, [tasks]);

  // Cell status and styling calculation
  const getCellMeta = useCallback(
    (teammateId: string, dateStr: string): CellMeta => {
      const isFuture = dateStr > todayDate;
      const isToday = dateStr === todayDate;
      const sub = submissionsMap[`${teammateId}_${dateStr}`] || null;
      const dayTasks = (tasksByDate[dateStr] || []).filter(
        (t) => t.assigned_to === null || t.assigned_to === teammateId
      );

      if (isFuture) {
        return {
          status: 'future',
          colorClass: 'border border-[#2F353D] bg-transparent text-[#9AA3AE]/40 cursor-default',
          label: 'Future date',
          submission: null,
        };
      }

      if (sub?.status === 'approved') {
        return {
          status: 'approved',
          colorClass:
            'bg-[#34C759] text-[#14171B] font-bold hover:brightness-110 shadow-xs cursor-pointer',
          label: 'Approved submission',
          submission: sub,
        };
      }

      if (sub?.status === 'pending') {
        return {
          status: 'pending',
          colorClass:
            'bg-[#FFB020] text-[#14171B] font-bold hover:brightness-110 shadow-xs cursor-pointer animate-pulse ring-1 ring-white/40',
          label: 'Pending review (Tap to inspect)',
          submission: sub,
        };
      }

      if (sub?.status === 'rejected') {
        return {
          status: 'rejected',
          colorClass:
            'bg-[#FF3B30] text-white font-bold hover:brightness-110 shadow-xs cursor-pointer',
          label: 'Rejected submission',
          submission: sub,
        };
      }

      // Missed: past date with tasks but no submission
      if (dateStr < todayDate && dayTasks.length > 0) {
        return {
          status: 'missed',
          colorClass:
            'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40 font-medium cursor-default',
          label: 'Missed tasks (No submission)',
          submission: null,
        };
      }

      return {
        status: 'past_empty',
        colorClass: 'bg-[#252A31] text-[#9AA3AE] border border-[#2F353D]/50 cursor-default',
        label: isToday ? 'Today (Awaiting submission)' : 'No submission',
        submission: null,
      };
    },
    [todayDate, submissionsMap, tasksByDate]
  );

  // Filter teammates based on top bar search input
  const filteredTeammates = useMemo(() => {
    if (!searchQuery.trim()) return teammates;
    const q = searchQuery.toLowerCase();
    return teammates.filter(
      (t) =>
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q))
    );
  }, [teammates, searchQuery]);

  // Client-side analytics & metrics derivation
  // 1. Team completion % this month
  const { teamCompletionPercent, approvedDaysCount, totalEligibleDays } = useMemo(() => {
    const elapsedDaysInMonth = daysInMonth.filter((d) => d.date <= todayDate).length;
    const eligible = teammates.length * Math.max(1, elapsedDaysInMonth);
    const approved = submissions.filter((s) => s.status === 'approved').length;
    const pct = eligible > 0 ? Math.min(100, Math.round((approved / eligible) * 100)) : 0;
    return {
      teamCompletionPercent: pct,
      approvedDaysCount: approved,
      totalEligibleDays: eligible,
    };
  }, [daysInMonth, todayDate, teammates, submissions]);

  // 2. Daily submission count for Area Line Chart
  const lineChartData = useMemo(() => {
    return daysInMonth.map((d) => {
      const count = submissions.filter((s) => s.date === d.date && s.status === 'approved').length;
      return {
        day: d.dayNum,
        date: d.date,
        approved: count,
      };
    });
  }, [daysInMonth, submissions]);

  // 3. Today's status breakdown for Donut Ring Chart
  const todayBreakdown = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejectedOrMissed = 0;
    let noSub = 0;

    for (const t of teammates) {
      const meta = getCellMeta(t.id, todayDate);
      if (meta.status === 'approved') approved++;
      else if (meta.status === 'pending') pending++;
      else if (meta.status === 'rejected' || meta.status === 'missed') rejectedOrMissed++;
      else noSub++;
    }

    const totalSubmitted = approved + pending + (submissions.filter((s) => s.date === todayDate && s.status === 'rejected').length);

    // Yesterday's total submitted for change comparison (calculated purely from todayDate)
    const [ty, tm, td] = todayDate.split('-').map(Number);
    const yesterday = new Date(Date.UTC(ty, tm - 1, td - 1)).toISOString().split('T')[0];
    const yesterdaySubmitted = submissions.filter((s) => s.date === yesterday).length;
    const diff = totalSubmitted - yesterdaySubmitted;

    return {
      approved,
      pending,
      rejectedOrMissed,
      noSub,
      totalSubmitted,
      changeSinceYesterday: diff,
      chartData: [
        { name: 'Approved', value: approved, color: '#34C759' },
        { name: 'Pending', value: pending, color: '#FFB020' },
        { name: 'Missed / Rejected', value: rejectedOrMissed, color: '#FF3B30' },
        { name: 'No Submission', value: noSub, color: '#2F353D' },
      ].filter((item) => item.value > 0),
    };
  }, [teammates, getCellMeta, todayDate, submissions]);

  // 4. Pending reviews list
  const pendingSubmissionsList = useMemo(() => {
    const list: { teammate: Profile; submission: Submission; date: string }[] = [];
    for (const s of submissions) {
      if (s.status === 'pending') {
        const tm = teammates.find((t) => t.id === s.user_id);
        if (tm) {
          list.push({ teammate: tm, submission: s, date: s.date });
        }
      }
    }
    // Sort recent first
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [submissions, teammates]);

  // 5. Top 3 Streaks
  const topStreaks = useMemo(() => {
    const streaks = teammates.map((t) => {
      let streak = 0;
      const sortedDays = [...daysInMonth]
        .filter((d) => d.date <= todayDate)
        .sort((a, b) => b.date.localeCompare(a.date));

      for (const d of sortedDays) {
        const s = submissionsMap[`${t.id}_${d.date}`];
        if (s?.status === 'approved') {
          streak++;
        } else {
          break;
        }
      }
      return { teammate: t, streak };
    });

    return streaks.sort((a, b) => b.streak - a.streak).slice(0, 3);
  }, [teammates, daysInMonth, todayDate, submissionsMap]);

  // 6. Best Day, Worst Day, Total Approved for Submissions Month grid
  const monthDayInsights = useMemo(() => {
    let bestDay = { date: '', count: -1 };
    let worstDay = { date: '', count: -1 };

    for (const d of daysInMonth) {
      if (d.date > todayDate) continue;
      const dayApproved = submissions.filter((s) => s.date === d.date && s.status === 'approved').length;
      const dayMissed = teammates.length - dayApproved;

      if (dayApproved > bestDay.count) {
        bestDay = { date: d.date, count: dayApproved };
      }
      if (dayMissed > worstDay.count) {
        worstDay = { date: d.date, count: dayMissed };
      }
    }

    return {
      bestDay: bestDay.date ? formatISTDisplayDate(bestDay.date) : '—',
      worstDay: worstDay.date ? formatISTDisplayDate(worstDay.date) : '—',
      totalApproved: approvedDaysCount,
    };
  }, [daysInMonth, todayDate, submissions, teammates, approvedDaysCount]);

  // Filter visible days according to range pills (1W, 1M, 3M, All)
  const visibleGridDays = useMemo(() => {
    if (timeRange === '1W') {
      const [y, m, d] = todayDate.split('-').map(Number);
      const weekDates = new Set<string>();
      for (let i = 0; i < 7; i++) {
        const dt = new Date(Date.UTC(y, m - 1, d - i));
        weekDates.add(dt.toISOString().split('T')[0]);
      }
      return daysInMonth.filter((day) => weekDates.has(day.date));
    }
    return daysInMonth;
  }, [daysInMonth, timeRange, todayDate]);

  // Month navigation
  const handlePrevMonth = () => {
    setLoading(true);
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setLoading(true);
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Open Review Modal
  const handleCellClick = useCallback((teammate: Profile, dateStr: string, sub: Submission) => {
    const dayTasks = (tasksByDate[dateStr] || []).filter(
      (t) => t.assigned_to === null || t.assigned_to === teammate.id
    );

    setReviewTarget({
      teammate,
      date: dateStr,
      submission: sub,
      tasks: dayTasks,
    });
    setActionError(null);
  }, [tasksByDate]);

  // Update status (Approve / Reject)
  const handleUpdateStatus = async (newStatus: 'approved' | 'rejected') => {
    if (!reviewTarget) return;

    setUpdatingStatus(true);
    setActionError(null);

    try {
      const { error: updateErr } = await supabase
        .from('submissions')
        .update({ status: newStatus })
        .eq('id', reviewTarget.submission.id);

      if (updateErr) throw updateErr;

      setReviewTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update submission status.';
      setActionError(msg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle opening review modal when navigated from notification
  useEffect(() => {
    if (loading) return;

    const openSubmissionModal = async (subId: string) => {
      let sub = submissions.find((s) => String(s.id) === subId);
      if (!sub) {
        const { data: fetchedSub } = await supabase
          .from('submissions')
          .select('*')
          .eq('id', subId)
          .single();
        if (fetchedSub) sub = fetchedSub;
      }

      if (sub) {
        let tm = teammates.find((t) => t.id === sub.user_id);
        if (!tm) {
          const { data: fetchedTm } = await supabase
            .from('profiles')
            .select('id, name, email, role')
            .eq('id', sub.user_id)
            .single();
          if (fetchedTm) tm = fetchedTm;
        }

        if (tm) {
          handleCellClick(tm, sub.date, sub);
        }
      }
    };

    // 1. Check URL query param on mount
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const reviewParam = params.get('review');
      if (reviewParam) {
        openSubmissionModal(reviewParam);
        const url = new URL(window.location.href);
        url.searchParams.delete('review');
        window.history.replaceState({}, '', url.toString());
      }
    }

    // 2. Custom event listener if user is already on /admin
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ submissionId: string | number }>;
      if (customEvent.detail?.submissionId) {
        openSubmissionModal(String(customEvent.detail.submissionId));
      }
    };

    window.addEventListener('open-admin-review', handleCustomEvent);
    return () => window.removeEventListener('open-admin-review', handleCustomEvent);
  }, [loading, submissions, teammates, handleCellClick]);

  return (
    <DashboardShell
      searchPlaceholder="Filter teammates..."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      pendingCount={pendingSubmissionsList.length}
    >
      <div className="space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-5 h-80 rounded-[18px]" />
            <Skeleton className="lg:col-span-4 h-80 rounded-[18px]" />
            <Skeleton className="lg:col-span-3 h-80 rounded-[18px]" />
            <Skeleton className="lg:col-span-12 h-96 rounded-[18px]" />
          </div>
        ) : error ? (
          <Toast type="error" message={error} />
        ) : (
          <>
            {/* Top Row: 12-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* 1. Top-Left Large Card: Team Completion (lg:col-span-5) */}
              <Card stagger={1} className="lg:col-span-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-medium tracking-wide text-[#9AA3AE] uppercase">
                      Team Completion
                    </span>
                    {/* Week / Month / Year Pills */}
                    <div className="flex items-center gap-1 bg-[#252A31] p-1 rounded-full border border-[#2F353D]">
                      {(['Week', 'Month', 'Year'] as const).map((pill) => (
                        <button
                          key={pill}
                          type="button"
                          onClick={() => setChartView(pill)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                            chartView === pill
                              ? 'bg-[#2F353D] text-white shadow-xs'
                              : 'text-[#9AA3AE] hover:text-[#D9DEE5]'
                          }`}
                        >
                          {pill}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="font-serif text-4xl sm:text-5xl font-light text-[#D9DEE5]">
                      {teamCompletionPercent}%
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#34C759] bg-[#34C759]/15 px-2 py-0.5 rounded-full border border-[#34C759]/30">
                      ↑ +4.2% vs last month
                    </span>
                  </div>
                  <span className="text-xs text-[#9AA3AE] block mb-4">
                    {approvedDaysCount} of {totalEligibleDays} verified shift days
                  </span>

                  {/* Recharts Area Line Chart with soft red gradient */}
                  <div className="h-36 w-full -ml-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={lineChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#FF3B30" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="day"
                          stroke="#9AA3AE"
                          fontSize={10}
                          tickLine={false}
                          axisLine={{ stroke: '#2F353D' }}
                        />
                        <YAxis
                          stroke="#9AA3AE"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          width={25}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#252A31',
                            borderColor: '#2F353D',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: '#D9DEE5',
                          }}
                          labelFormatter={(val) => `Day ${val}`}
                          formatter={(val) => [`${val} approved`, 'Shift submissions']}
                        />
                        <Area
                          type="monotone"
                          dataKey="approved"
                          stroke="#FF3B30"
                          strokeWidth={2}
                          fill="url(#redGradient)"
                          dot={false}
                          activeDot={{ r: 4, fill: '#FF3B30', stroke: '#1C1F24', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Action buttons below */}
                <div className="pt-4 border-t border-[#2F353D] flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (pendingSubmissionsList.length > 0) {
                        const first = pendingSubmissionsList[0];
                        handleCellClick(first.teammate, first.date, first.submission);
                      }
                    }}
                    className="gap-1.5"
                  >
                    <span>Review pending</span>
                    {pendingSubmissionsList.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-white/20 text-white text-[10px] flex items-center justify-center font-bold">
                        {pendingSubmissionsList.length}
                      </span>
                    )}
                  </Button>
                  <Link href="/admin/tasks">
                    <Button variant="secondary" size="sm">
                      Add task
                    </Button>
                  </Link>
                  <Link href="/admin/team">
                    <Button variant="secondary" size="sm">
                      Team
                    </Button>
                  </Link>
                </div>
              </Card>

              {/* 2. Middle Card: Today's Status (lg:col-span-4) */}
              <Card stagger={2} className="lg:col-span-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium tracking-wide text-[#9AA3AE] uppercase">
                      Today&apos;s Status
                    </span>
                    <span className="text-xs text-[#D9DEE5] font-medium">
                      {formatISTDisplayDate(todayDate)}
                    </span>
                  </div>

                  {/* Donut Ring Chart & Legend */}
                  <div className="flex items-center gap-4 my-2">
                    <div className="w-28 h-28 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={todayBreakdown.chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={32}
                            outerRadius={48}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                          >
                            {todayBreakdown.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex-1 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[#34C759]">
                          <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                          Approved
                        </span>
                        <span className="font-semibold">{todayBreakdown.approved}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[#FFB020]">
                          <span className="w-2 h-2 rounded-full bg-[#FFB020]" />
                          Pending
                        </span>
                        <span className="font-semibold">{todayBreakdown.pending}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[#FF3B30]">
                          <span className="w-2 h-2 rounded-full bg-[#FF3B30]" />
                          Missed
                        </span>
                        <span className="font-semibold">{todayBreakdown.rejectedOrMissed}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[#9AA3AE]">
                          <span className="w-2 h-2 rounded-full bg-[#2F353D]" />
                          No submission
                        </span>
                        <span className="font-semibold">{todayBreakdown.noSub}</span>
                      </div>
                    </div>
                  </div>

                  {/* Per-status progress bars */}
                  <div className="space-y-2 pt-2 border-t border-[#2F353D]">
                    <div>
                      <div className="flex justify-between text-[10px] text-[#9AA3AE] mb-1">
                        <span>Approval completion</span>
                        <span className="text-[#34C759]">
                          {teammates.length > 0 ? Math.round((todayBreakdown.approved / teammates.length) * 100) : 0}%
                        </span>
                      </div>
                      <ProgressBar
                        value={teammates.length > 0 ? (todayBreakdown.approved / teammates.length) * 100 : 0}
                        color="#34C759"
                      />
                    </div>
                  </div>
                </div>

                {/* Total submitted today & change */}
                <div className="pt-3 border-t border-[#2F353D] flex items-center justify-between text-xs text-[#9AA3AE]">
                  <span>Total submitted today:</span>
                  <div className="flex items-center gap-1.5 text-[#D9DEE5] font-semibold">
                    <span>{todayBreakdown.totalSubmitted}</span>
                    <span className="text-[10px] text-[#34C759]">
                      ({todayBreakdown.changeSinceYesterday >= 0 ? `+${todayBreakdown.changeSinceYesterday}` : todayBreakdown.changeSinceYesterday} vs yday)
                    </span>
                  </div>
                </div>
              </Card>

              {/* 3. Top-Right Stack: Pending Reviews & Top Streaks (lg:col-span-3) */}
              <div className="lg:col-span-3 space-y-6 flex flex-col justify-between">
                {/* Pending Reviews Card */}
                <Card stagger={3} className="space-y-3 flex-1">
                  <div className="flex items-center justify-between border-b border-[#2F353D] pb-2">
                    <span className="text-[11px] font-medium tracking-wide text-[#9AA3AE] uppercase">
                      Pending Reviews
                    </span>
                    <span className="text-xs font-bold text-[#FFB020]">
                      {pendingSubmissionsList.length}
                    </span>
                  </div>

                  {pendingSubmissionsList.length === 0 ? (
                    <p className="text-xs text-[#9AA3AE] italic py-2">
                      All caught up! No submissions awaiting review.
                    </p>
                  ) : (
                    <ul className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {pendingSubmissionsList.slice(0, 3).map((item) => (
                        <li
                          key={`${item.teammate.id}_${item.date}`}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#252A31] border border-[#2F353D]"
                        >
                          <div className="truncate max-w-[110px]">
                            <p className="text-xs font-semibold text-[#D9DEE5] truncate">
                              {item.teammate.name || item.teammate.email}
                            </p>
                            <p className="text-[10px] text-[#9AA3AE]">{item.date}</p>
                          </div>
                          <Button
                            variant="pill"
                            size="sm"
                            onClick={() => handleCellClick(item.teammate, item.date, item.submission)}
                            className="!px-2.5 !py-0.5 !text-[10px] shrink-0 hover:border-[#FFB020] hover:text-[#FFB020]"
                          >
                            Review
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                {/* Top Streaks Card */}
                <Card stagger={3} className="space-y-3 flex-1">
                  <div className="flex items-center justify-between border-b border-[#2F353D] pb-2">
                    <span className="text-[11px] font-medium tracking-wide text-[#9AA3AE] uppercase">
                      Top Streaks
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]" />
                  </div>

                  <ul className="space-y-2.5">
                    {topStreaks.map((item, idx) => (
                      <li key={item.teammate.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#D9DEE5] font-medium truncate max-w-[120px]">
                            <span className="text-[#9AA3AE] mr-1.5 font-mono text-[10px]">#{idx + 1}</span>
                            {item.teammate.name || item.teammate.email}
                          </span>
                          <span className="font-serif text-sm font-semibold text-[#D9DEE5]">
                            {item.streak} <span className="text-[10px] font-normal text-[#9AA3AE]">days</span>
                          </span>
                        </div>
                        <ProgressBar
                          value={Math.min(100, (item.streak / 30) * 100)}
                          hasRedTip={idx === 0}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>

            {/* 4. Bottom Wide Card: Submissions This Month (lg:col-span-12) */}
            <Card stagger={1} className="space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2F353D]">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] tracking-[0.2em] font-semibold text-[#9AA3AE] uppercase block mb-0.5">
                      SHIFT AUDIT
                    </span>
                    <h2 className="font-serif text-2xl font-light text-[#D9DEE5]">
                      Submissions this month
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <Button variant="icon" size="sm" onClick={handlePrevMonth} aria-label="Previous Month">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </Button>
                    <span className="text-xs font-medium text-[#D9DEE5] min-w-[110px] text-center">
                      {formatMonthYear(currentYear, currentMonth - 1)}
                    </span>
                    <Button variant="icon" size="sm" onClick={handleNextMonth} aria-label="Next Month">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Button>
                  </div>
                </div>

                {/* Range Pill Group & Summary Side Panel */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1 bg-[#252A31] p-1 rounded-full border border-[#2F353D]">
                    {(['1W', '1M', '3M', 'All'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setTimeRange(r)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          timeRange === r
                            ? 'bg-[#2F353D] text-white shadow-xs'
                            : 'text-[#9AA3AE] hover:text-[#D9DEE5]'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  {/* Summary Strip: Best day, Worst day, Total approved */}
                  <div className="hidden sm:flex items-center gap-4 pl-4 border-l border-[#2F353D] text-xs">
                    <div>
                      <span className="text-[10px] text-[#9AA3AE] block">Best day</span>
                      <span className="font-semibold text-[#34C759]">{monthDayInsights.bestDay}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#9AA3AE] block">Worst day</span>
                      <span className="font-semibold text-[#FF3B30]">{monthDayInsights.worstDay}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#9AA3AE] block">Total approved</span>
                      <span className="font-semibold text-[#D9DEE5]">{monthDayInsights.totalApproved}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid Table */}
              <div className="overflow-x-auto relative rounded-xl border border-[#2F353D] bg-[#252A31]/40">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#2F353D] bg-[#252A31] text-[11px] font-semibold text-[#D9DEE5]">
                      <th className="sticky left-0 z-30 bg-[#252A31] px-4 py-3 min-w-[160px] sm:min-w-[190px] shadow-[1px_0_0_#2F353D]">
                        Teammate
                      </th>
                      {visibleGridDays.map((d) => {
                        const isToday = d.date === todayDate;
                        return (
                          <th
                            key={d.date}
                            className={`px-1 py-3 text-center min-w-[34px] sm:min-w-[38px] ${
                              isToday ? 'text-[#FF3B30] font-bold' : 'text-[#9AA3AE]'
                            }`}
                          >
                            <div className="text-[9px] uppercase font-medium">{d.dayOfWeek}</div>
                            <div>{d.dayNum}</div>
                          </th>
                        );
                      })}
                      <th className="px-4 py-3 text-right font-semibold min-w-[90px] border-l border-[#2F353D]">
                        Approved
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F353D] text-xs">
                    {filteredTeammates.map((t) => {
                      const approvedCount = daysInMonth.filter((d) => {
                        const sub = submissionsMap[`${t.id}_${d.date}`];
                        return sub?.status === 'approved';
                      }).length;

                      return (
                        <tr key={t.id} className="hover:bg-[#252A31]/60 transition-colors">
                          <td className="sticky left-0 z-20 bg-[#1C1F24] px-4 py-3 font-medium text-[#D9DEE5] shadow-[1px_0_0_#2F353D]">
                            <span className="block truncate max-w-[150px] sm:max-w-[180px]">
                              {t.name || 'Unnamed teammate'}
                            </span>
                            <span className="text-[10px] text-[#9AA3AE] block truncate max-w-[150px] sm:max-w-[180px]">
                              {t.email || ''}
                            </span>
                          </td>

                          {visibleGridDays.map((d) => {
                            const meta = getCellMeta(t.id, d.date);
                            const hasSub = !!meta.submission;

                            return (
                              <td key={d.date} className="p-1 text-center">
                                {hasSub && meta.submission ? (
                                  <div className="relative inline-block">
                                    <button
                                      type="button"
                                      onClick={() => handleCellClick(t, d.date, meta.submission!)}
                                      title={`${t.name} on ${d.date}: ${meta.label}`}
                                      className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded-md flex items-center justify-center transition-transform hover:scale-115 active:scale-95 ${meta.colorClass}`}
                                    >
                                      {meta.status === 'approved' && (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                      {meta.status === 'pending' && (
                                        <span className="w-2 h-2 rounded-full bg-[#14171B] animate-ping" />
                                      )}
                                      {meta.status === 'rejected' && (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                    </button>
                                    {meta.submission.task_status?.some((item) => !item.done) && (
                                      <span
                                        title="Reason given"
                                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FF3B30] border border-[#14171B] shadow-[0_0_4px_#FF3B30] pointer-events-auto z-10"
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    title={`${t.name} on ${d.date}: ${meta.label}`}
                                    className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto rounded-md flex items-center justify-center select-none ${meta.colorClass}`}
                                  >
                                    {meta.status === 'missed' && (
                                      <span className="text-[10px] font-bold">✕</span>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          <td className="px-4 py-3 text-right font-serif text-lg font-light text-[#34C759] border-l border-[#2F353D]">
                            {approvedCount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* Review Modal */}
        <Modal
          isOpen={!!reviewTarget}
          onClose={() => setReviewTarget(null)}
          eyebrow={reviewTarget ? formatISTDisplayDate(reviewTarget.date) : ''}
          title={reviewTarget?.teammate.name || 'Submission Review'}
          maxWidth="max-w-md"
        >
          {reviewTarget && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#2F353D]">
                <span className="text-xs text-[#9AA3AE]">Current Status</span>
                <Badge status={reviewTarget.submission.status} />
              </div>

              {/* Task list from task_status */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] tracking-wider uppercase font-semibold text-[#9AA3AE] block">
                    Task Breakdown
                  </span>
                  {reviewTarget.submission.task_status &&
                    reviewTarget.submission.task_status.length > 0 && (
                      <span className="text-xs text-[#9AA3AE] font-medium px-2.5 py-0.5 rounded-full bg-[#252A31] border border-[#2F353D]">
                        {
                          reviewTarget.submission.task_status.filter((t) => t.done).length
                        }{' '}
                        of {reviewTarget.submission.task_status.length} done
                      </span>
                    )}
                </div>

                {reviewTarget.submission.task_status &&
                reviewTarget.submission.task_status.length > 0 ? (
                  <ul className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {reviewTarget.submission.task_status.map((item) => (
                      <li
                        key={item.task_id}
                        className="p-3 rounded-xl bg-[#252A31] border border-[#2F353D] space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`w-4 h-4 min-w-4 min-h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                                item.done
                                  ? 'bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/40'
                                  : 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40'
                              }`}
                            >
                              {item.done ? '✓' : '✕'}
                            </span>
                            <span className="text-xs text-[#D9DEE5] font-medium">
                              {item.title}
                            </span>
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

                        {!item.done && (
                          <div className="pl-6 pt-0.5">
                            <div className="p-2.5 rounded-lg bg-[#1C1F24] border-l-2 border-[#FF3B30] text-xs text-[#9AA3AE] italic">
                              <span className="not-italic font-semibold text-[10px] text-[#D9DEE5] block mb-0.5">
                                Teammate&apos;s reason:
                              </span>
                              &ldquo;{item.reason || 'No reason provided.'}&rdquo;
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : reviewTarget.tasks.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-[#9AA3AE] italic">
                      Legacy submission: task checklist breakdown not recorded.
                    </p>
                    <ul className="space-y-1.5">
                      {reviewTarget.tasks.map((tk) => (
                        <li
                          key={tk.id}
                          className="text-xs text-[#D9DEE5] p-2 rounded-lg bg-[#252A31] border border-[#2F353D] flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9AA3AE]" />
                          <span>{tk.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-[#9AA3AE] italic py-3">
                    No tasks associated with this shift day.
                  </p>
                )}
              </div>

              {actionError && <Toast type="error" message={actionError} />}

              {/* Approve & Reject Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#2F353D]">
                <Button
                  variant="danger"
                  loading={updatingStatus}
                  onClick={() => handleUpdateStatus('rejected')}
                  className="w-full"
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  loading={updatingStatus}
                  onClick={() => handleUpdateStatus('approved')}
                  className="w-full"
                >
                  Approve
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardShell>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard allowedRoles={['admin']}>
      <AdminContent />
    </AuthGuard>
  );
}
