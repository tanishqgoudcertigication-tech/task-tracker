'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
import { Toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAuth } from '@/context/auth-context';
import { supabase, Task, Submission, TaskStatusItem } from '@/lib/supabase';
import { getTodayIST, formatISTDisplayDate } from '@/lib/date';

function TodayContent() {
  const { user, profile } = useAuth();

  const [todayDate] = useState(() => getTodayIST());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive task choices ('done' | 'not_done') & reasons for not_done
  const [taskChoices, setTaskChoices] = useState<Record<string, 'done' | 'not_done'>>({});
  const [taskReasons, setTaskReasons] = useState<Record<string, string>>({});
  const [touchedReasons, setTouchedReasons] = useState<Record<string, boolean>>({});

  // Submission state
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [allUserSubmissions, setAllUserSubmissions] = useState<Submission[]>([]);
  const [submissionLoading, setSubmissionLoading] = useState(true);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Refresh key
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      if (!user) return;

      // 1. Fetch tasks for today: date = today (IST) and (assigned_to is null or assigned_to = user.id)
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('date', todayDate)
          .or(`assigned_to.is.null,assigned_to.eq.${user.id}`)
          .order('id', { ascending: true });

        if (!ignore) {
          if (error) {
            setTasksError(error.message);
          } else {
            setTasks(data || []);
            setTasksError(null);
          }
          setTasksLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to load tasks.';
          setTasksError(msg);
          setTasksLoading(false);
        }
      }

      // 2. Fetch user's submissions (all for streak & charts, plus today's)
      try {
        const { data, error } = await supabase
          .from('submissions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (!ignore) {
          if (error) {
            setSubmissionError(error.message);
          } else {
            setAllUserSubmissions(data || []);
            const todaySub = (data || []).find((s) => s.date === todayDate) || null;
            setSubmission(todaySub);
            setSubmissionError(null);

            // Prepopulate choices & reasons if today's submission exists
            if (todaySub?.task_status && Array.isArray(todaySub.task_status)) {
              const initialChoices: Record<string, 'done' | 'not_done'> = {};
              const initialReasons: Record<string, string> = {};
              todaySub.task_status.forEach((item: TaskStatusItem) => {
                initialChoices[item.task_id] = item.done ? 'done' : 'not_done';
                if (item.reason) {
                  initialReasons[item.task_id] = item.reason;
                }
              });
              setTaskChoices(initialChoices);
              setTaskReasons(initialReasons);
            }
          }
          setSubmissionLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to load submission.';
          setSubmissionError(msg);
          setSubmissionLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [user, todayDate, refreshKey]);

  // Handle task choice selection ('done' or 'not_done')
  const handleSelectChoice = (taskId: string, choice: 'done' | 'not_done') => {
    setTaskChoices((prev) => ({
      ...prev,
      [taskId]: choice,
    }));
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  // Handle reason text change
  const handleReasonChange = (taskId: string, val: string) => {
    setTaskReasons((prev) => ({
      ...prev,
      [taskId]: val,
    }));
    setTouchedReasons((prev) => ({
      ...prev,
      [taskId]: true,
    }));
  };

  // Submission handler
  const handleSubmitDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || tasks.length === 0) return;

    // Validate that every task is chosen and all 'not_done' tasks have valid reasons
    const missingChoice = tasks.find((t) => !taskChoices[t.id]);
    if (missingChoice) {
      setSubmitError('Please mark every task as either Done or Not done.');
      return;
    }

    const invalidReason = tasks.find((t) => {
      if (taskChoices[t.id] === 'not_done') {
        const r = (taskReasons[t.id] || '').trim();
        return r.length < 5 || r.length > 300;
      }
      return false;
    });

    if (invalidReason) {
      setSubmitError(
        'Please provide a valid reason (between 5 and 300 characters) for all incomplete tasks.'
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const taskStatusPayload: TaskStatusItem[] = tasks.map((t) => {
      const isDone = taskChoices[t.id] === 'done';
      return {
        task_id: t.id,
        title: t.title,
        done: isDone,
        reason: !isDone ? (taskReasons[t.id] || '').trim() : undefined,
      };
    });

    try {
      if (submission && submission.status === 'rejected') {
        // Update existing rejected row to 'pending'
        const { error: updateError } = await supabase
          .from('submissions')
          .update({
            status: 'pending',
            task_status: taskStatusPayload,
          })
          .eq('id', submission.id);

        if (updateError) throw updateError;
      } else {
        // Insert new pending row
        const { error: insertError } = await supabase
          .from('submissions')
          .insert({
            user_id: user.id,
            date: todayDate,
            status: 'pending',
            task_status: taskStatusPayload,
          });

        if (insertError) throw insertError;
      }

      setSubmitSuccess('Daily tasks submitted successfully!');
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      console.error('Submission failed:', err);
      const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter tasks by top bar search
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    return tasks.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tasks, searchQuery]);

  // Read-only vs editable mode
  // Allow editing and resubmitting only if there is no submission or if status is 'rejected'
  const isReadOnly = !!submission && submission.status !== 'rejected';
  const isRejected = !!submission && submission.status === 'rejected';

  // Counts & Validation
  const doneCount = tasks.filter((t) => taskChoices[t.id] === 'done').length;
  const progressPercent = tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0;
  const firstName = profile?.name ? profile.name.split(' ')[0] : 'there';
  const uncompletedTasksCount = tasks.length - doneCount;

  // Check form validity for submit button
  const isFormValid = useMemo(() => {
    if (tasks.length === 0) return false;
    for (const t of tasks) {
      const choice = taskChoices[t.id];
      if (!choice) return false;
      if (choice === 'not_done') {
        const r = (taskReasons[t.id] || '').trim();
        if (r.length < 5 || r.length > 300) return false;
      }
    }
    return true;
  }, [tasks, taskChoices, taskReasons]);

  // Derive Streak, 14-day strip, Completion ring, and "This week" bar chart client-side
  const subMap = useMemo(() => {
    const map: Record<string, Submission> = {};
    for (const s of allUserSubmissions) {
      map[s.date] = s;
    }
    return map;
  }, [allUserSubmissions]);

  // Streak: consecutive approved days ending today (or yesterday)
  const currentStreak = useMemo(() => {
    const [y, m, d] = todayDate.split('-').map(Number);
    const todayApproved = subMap[todayDate]?.status === 'approved';
    const startOffset = todayApproved ? 0 : 1;
    let streak = 0;

    for (let i = 0; i < 365; i++) {
      const dt = new Date(Date.UTC(y, m - 1, d - startOffset - i));
      const iso = dt.toISOString().split('T')[0];
      if (subMap[iso]?.status === 'approved') {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [todayDate, subMap]);

  // Mini 14-day strip (last 14 days)
  const mini14Days = useMemo(() => {
    const days: { date: string; status: 'approved' | 'pending' | 'rejected' | 'past_empty' }[] = [];
    const [y, m, d] = todayDate.split('-').map(Number);
    for (let i = 13; i >= 0; i--) {
      const dt = new Date(Date.UTC(y, m - 1, d - i));
      const iso = dt.toISOString().split('T')[0];
      const s = subMap[iso];
      let st: 'approved' | 'pending' | 'rejected' | 'past_empty' = 'past_empty';
      if (s?.status === 'approved') st = 'approved';
      else if (s?.status === 'pending') st = 'pending';
      else if (s?.status === 'rejected') st = 'rejected';
      days.push({ date: iso, status: st });
    }
    return days;
  }, [todayDate, subMap]);

  // Completion % Ring
  const totalApproved = useMemo(() => {
    return allUserSubmissions.filter((s) => s.status === 'approved').length;
  }, [allUserSubmissions]);

  const completionRate = useMemo(() => {
    const total = Math.max(1, allUserSubmissions.length);
    return Math.round((totalApproved / total) * 100);
  }, [totalApproved, allUserSubmissions]);

  const ringData = useMemo(() => {
    return [
      { name: 'Approved', value: completionRate, color: '#34C759' },
      { name: 'Remaining', value: 100 - completionRate, color: '#252A31' },
    ];
  }, [completionRate]);

  // "This week" bar chart of approved days (Mon - Sun)
  const thisWeekData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return weekLabels.map((label, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const iso = d.toISOString().split('T')[0];
      const s = subMap[iso];
      return {
        day: label,
        approved: s?.status === 'approved' ? 1 : 0,
        pending: s?.status === 'pending' ? 1 : 0,
      };
    });
  }, [subMap]);

  return (
    <DashboardShell
      searchPlaceholder="Search shift tasks..."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      pendingCount={uncompletedTasksCount}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Large Card: Tasks Checklist & Submission (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          <Card stagger={1} className="space-y-6">
            {/* Greeting & Date Header */}
            <div className="space-y-1 pb-4 border-b border-[#2F353D]">
              <span className="text-[10px] sm:text-[11px] tracking-[0.25em] font-semibold text-[#9AA3AE] uppercase block">
                {formatISTDisplayDate(todayDate)}
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl font-light text-[#D9DEE5] tracking-tight">
                Good morning, {firstName}
              </h1>
              <p className="text-xs text-[#9AA3AE]">
                Check off your tasks, provide reasons for any incomplete items, and keep your streak unbroken.
              </p>
            </div>

            {/* Status Banner when submitted */}
            {submission && (
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-[#2F353D]">
                  <span className="text-xs font-medium text-[#9AA3AE]">Today&apos;s Submission</span>
                  <Badge status={submission.status} />
                </div>

                {submission.status === 'approved' && (
                  <Toast
                    type="success"
                    message="Submission approved by admin. Daily streak safely extended!"
                  />
                )}
                {submission.status === 'pending' && (
                  <Toast
                    type="pending"
                    message="Submission sent. Awaiting admin review."
                  />
                )}
                {submission.status === 'rejected' && (
                  <Toast
                    type="error"
                    message="Submission rejected. Please review task statuses, provide complete reasons, and resubmit."
                  />
                )}
              </div>
            )}

            {/* Checklist Header */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] tracking-[0.2em] font-semibold text-[#9AA3AE] uppercase block mb-0.5">
                  CHECKLIST
                </span>
                <h2 className="font-serif text-xl font-light text-[#D9DEE5]">
                  Today&apos;s Shift Tasks
                </h2>
              </div>
              {tasks.length > 0 && (
                <span className="text-xs text-[#9AA3AE] font-medium px-3 py-1 rounded-full bg-[#252A31] border border-[#2F353D]">
                  {doneCount} of {tasks.length} done
                </span>
              )}
            </div>

            {tasks.length > 0 && <ProgressBar value={progressPercent} />}

            {tasksLoading || submissionLoading ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : tasksError ? (
              <Toast type="error" message={tasksError} />
            ) : submissionError ? (
              <Toast type="error" message={submissionError} />
            ) : filteredTasks.length === 0 ? (
              <EmptyState
                title="No tasks scheduled"
                description={`No shift tasks found for today (${todayDate}). Check back later or ask your manager.`}
              />
            ) : isReadOnly ? (
              /* READ-ONLY SUMMARY (status pending or approved) */
              <div className="space-y-3">
                <ul className="space-y-3">
                  {filteredTasks.map((task) => {
                    const isTaskDone = taskChoices[task.id] === 'done';
                    const reason = taskReasons[task.id] || '';

                    return (
                      <li
                        key={task.id}
                        className="p-3.5 rounded-xl bg-[#252A31] border border-[#2F353D] space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span
                              className={`w-5 h-5 min-w-5 min-h-5 rounded-full flex items-center justify-center text-xs mt-0.5 ${
                                isTaskDone
                                  ? 'bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/40'
                                  : 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40'
                              }`}
                            >
                              {isTaskDone ? '✓' : '✕'}
                            </span>
                            <span
                              className={`text-sm ${
                                isTaskDone ? 'text-[#D9DEE5]' : 'text-[#D9DEE5] font-medium'
                              }`}
                            >
                              {task.title}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              isTaskDone
                                ? 'bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/30'
                                : 'bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/30'
                            }`}
                          >
                            {isTaskDone ? 'Done' : 'Not done'}
                          </span>
                        </div>

                        {!isTaskDone && reason && (
                          <div className="pl-8 pt-1">
                            <div className="p-2.5 rounded-lg bg-[#1C1F24] border-l-2 border-[#FF3B30] text-xs text-[#9AA3AE] italic">
                              <span className="not-italic font-semibold text-[11px] text-[#D9DEE5] block mb-0.5">
                                Reason provided:
                              </span>
                              &ldquo;{reason}&rdquo;
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <p className="text-center text-xs text-[#9AA3AE] pt-3">
                  {submission?.status === 'approved'
                    ? 'All tasks have been verified by your admin.'
                    : 'Submission is locked while under admin review.'}
                </p>
              </div>
            ) : (
              /* EDITABLE FORM (unsubmitted or rejected) */
              <form onSubmit={handleSubmitDay} className="space-y-4">
                <ul className="space-y-3">
                  {filteredTasks.map((task) => {
                    const choice = taskChoices[task.id];
                    const isDone = choice === 'done';
                    const isNotDone = choice === 'not_done';
                    const reason = taskReasons[task.id] || '';
                    const isTouched = !!touchedReasons[task.id];
                    const trimmedReasonLen = reason.trim().length;

                    const hasReasonError =
                      isNotDone &&
                      (trimmedReasonLen < 5 || trimmedReasonLen > 300) &&
                      (isTouched || reason.length > 0);

                    return (
                      <li
                        key={task.id}
                        className="p-3.5 rounded-xl bg-[#252A31] border border-[#2F353D] space-y-3 transition-colors"
                      >
                        {/* Task Title & Choices */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <span className="text-sm font-medium text-[#D9DEE5] leading-snug">
                            {task.title}
                          </span>

                          {/* Done & Not done buttons with 44px min touch target */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSelectChoice(task.id, 'done')}
                              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#FF3B30] ${
                                isDone
                                  ? 'bg-[#34C759] text-[#14171B] shadow-[0_0_8px_rgba(52,199,89,0.4)]'
                                  : 'bg-[#1C1F24] text-[#9AA3AE] border border-[#2F353D] hover:border-[#34C759] hover:text-[#D9DEE5]'
                              }`}
                            >
                              <span className="text-sm">✓</span>
                              <span>Done</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSelectChoice(task.id, 'not_done')}
                              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#FF3B30] ${
                                isNotDone
                                  ? 'bg-[#FF3B30] text-white shadow-[0_0_8px_rgba(255,59,48,0.4)]'
                                  : 'bg-[#1C1F24] text-[#9AA3AE] border border-[#2F353D] hover:border-[#FF3B30] hover:text-[#D9DEE5]'
                              }`}
                            >
                              <span className="text-sm">✕</span>
                              <span>Not done</span>
                            </button>
                          </div>
                        </div>

                        {/* Required reason textarea if marked Not done */}
                        {isNotDone && (
                          <div className="pt-2 border-t border-[#2F353D]/60 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label
                                htmlFor={`reason-${task.id}`}
                                className="block text-xs font-medium text-[#D9DEE5]"
                              >
                                Why wasn&apos;t this completed?{' '}
                                <span className="text-[#FF3B30]">*</span>
                              </label>
                              <span
                                className={`text-[11px] ${
                                  trimmedReasonLen < 5
                                    ? 'text-[#FF3B30]'
                                    : trimmedReasonLen > 300
                                    ? 'text-[#FF3B30]'
                                    : 'text-[#9AA3AE]'
                                }`}
                              >
                                {reason.length} / 300
                              </span>
                            </div>

                            <textarea
                              id={`reason-${task.id}`}
                              rows={2}
                              value={reason}
                              maxLength={300}
                              onChange={(e) => handleReasonChange(task.id, e.target.value)}
                              placeholder="Explain what prevented completion (minimum 5 characters)..."
                              className={`w-full min-h-[72px] p-3 rounded-lg bg-[#1C1F24] border text-xs text-[#D9DEE5] placeholder-[#9AA3AE]/50 resize-y transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#FF3B30] ${
                                hasReasonError ? 'border-[#FF3B30]' : 'border-[#2F353D]'
                              }`}
                            />

                            {/* Inline error notice */}
                            {hasReasonError && (
                              <p className="text-[11px] text-[#FF3B30] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]" />
                                {trimmedReasonLen === 0
                                  ? 'A reason is required when a task is not done.'
                                  : trimmedReasonLen < 5
                                  ? `Reason must be at least 5 characters (${
                                      5 - trimmedReasonLen
                                    } more needed).`
                                  : 'Reason cannot exceed 300 characters.'}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {submitError && <Toast type="error" message={submitError} />}
                {submitSuccess && <Toast type="success" message={submitSuccess} />}

                {/* Submit / Resubmit Day button */}
                <div className="pt-3">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={submitting}
                    disabled={!isFormValid || submitting}
                    className="w-full min-h-[44px] text-sm"
                  >
                    {submitting
                      ? 'Submitting...'
                      : isRejected
                      ? 'Resubmit Day'
                      : 'Submit Day'}
                  </Button>
                  {!isFormValid && (
                    <p className="text-center text-[11px] text-[#9AA3AE] pt-2">
                      Mark every task as Done or Not done and provide reasons (min 5 chars) for any
                      incomplete tasks to enable submission.
                    </p>
                  )}
                </div>
              </form>
            )}
          </Card>
        </div>

        {/* Right Stack: Streak, Completion Ring, This Week Bar Chart (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Streak Card + Mini 14-Day Strip */}
          <Card stagger={2} className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#2F353D] pb-3">
              <span className="text-[11px] font-medium tracking-wide text-[#9AA3AE] uppercase">
                Active Streak
              </span>
              <div className="flex items-center gap-1.5 text-xs text-[#FF3B30]">
                <span className="w-2 h-2 rounded-full bg-[#FF3B30] shadow-[0_0_8px_#FF3B30]" />
                <span className="font-semibold">Ongoing</span>
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-serif text-5xl sm:text-6xl font-light text-[#D9DEE5]">
                {currentStreak}
              </span>
              <span className="text-sm text-[#9AA3AE]">consecutive days</span>
            </div>

            {/* Mini 14-Day Strip */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] uppercase font-semibold text-[#9AA3AE] block">
                Last 14 Days
              </span>
              <div className="grid grid-cols-14 gap-1 sm:gap-1.5">
                {mini14Days.map((d) => {
                  let bg = 'bg-[#252A31] border border-[#2F353D]';
                  if (d.status === 'approved') bg = 'bg-[#34C759] shadow-[0_0_4px_#34C759]';
                  else if (d.status === 'pending') bg = 'bg-[#FFB020] shadow-[0_0_4px_#FFB020]';
                  else if (d.status === 'rejected') bg = 'bg-[#FF3B30] shadow-[0_0_4px_#FF3B30]';

                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.status}`}
                      className={`w-full aspect-square rounded-sm ${bg} transition-transform hover:scale-125`}
                    />
                  );
                })}
              </div>
            </div>
          </Card>

          {/* 2. Completion % Ring */}
          <Card stagger={3} className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#2F353D] pb-3">
              <span className="text-[11px] font-medium tracking-wide text-[#9AA3AE] uppercase">
                Completion Rate
              </span>
              <span className="text-xs text-[#34C759] font-semibold">{totalApproved} approved</span>
            </div>

            <div className="flex items-center justify-between gap-4 py-2">
              <div className="space-y-1">
                <span className="font-serif text-4xl sm:text-5xl font-light text-[#D9DEE5] block">
                  {completionRate}%
                </span>
                <span className="text-xs text-[#9AA3AE] block">
                  Overall verified shift completion
                </span>
              </div>

              <div className="w-24 h-24 shrink-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ringData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={42}
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#34C759" />
                      <Cell fill="#252A31" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <span className="absolute font-semibold text-xs text-[#D9DEE5]">
                  {completionRate}%
                </span>
              </div>
            </div>
          </Card>

          {/* 3. "This Week" Bar Chart */}
          <Card stagger={3} className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#2F353D] pb-3">
              <span className="text-[11px] font-medium tracking-wide text-[#9AA3AE] uppercase">
                This Week (Mon – Sun)
              </span>
              <span className="text-xs text-[#9AA3AE]">Shift consistency</span>
            </div>

            <div className="h-36 w-full -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={thisWeekData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    stroke="#9AA3AE"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#2F353D' }}
                  />
                  <YAxis
                    stroke="#9AA3AE"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={20}
                    domain={[0, 1]}
                    ticks={[0, 1]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#252A31',
                      borderColor: '#2F353D',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#D9DEE5',
                    }}
                    formatter={(val, name) => [val === 1 ? 'Yes' : 'No', String(name)]}
                  />
                  <Bar dataKey="approved" fill="#34C759" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="pending" fill="#FFB020" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function TodayPage() {
  return (
    <AuthGuard>
      <TodayContent />
    </AuthGuard>
  );
}
