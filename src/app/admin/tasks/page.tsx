'use client';

import React, { useState, useEffect, useMemo, useId } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { supabase, Profile, Task } from '@/lib/supabase';
import {
  getTodayIST,
  formatISTDisplayDate,
  formatMonthYear,
  getMonthDays,
} from '@/lib/date';
import { parseAndValidateCSV, CSVTaskRow } from '@/lib/csv';

const BATCH_SIZE = 500;
const PAGE_SIZE = 50;

function TasksManagementContent() {
  const fileInputId = useId();

  const [todayDate] = useState(() => getTodayIST());

  // Teammates list for dropdowns and matching
  const [teammates, setTeammates] = useState<Profile[]>([]);
  const [, setTeammatesLoading] = useState(true);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  // Active tab: 'single' | 'csv'
  const [activeTab, setActiveTab] = useState<'single' | 'csv'>('single');

  // Form state: Add task
  const [taskDate, setTaskDate] = useState(() => getTodayIST());
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState<string>(''); // empty string = unassigned (everyone)

  // Repeat daily state
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number>(365);

  const [submittingTask, setSubmittingTask] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<CSVTaskRow[]>([]);
  const [csvHasErrors, setCsvHasErrors] = useState(false);
  const [csvErrorSummary, setCsvErrorSummary] = useState<string | null>(null);
  const [csvTotalValid, setCsvTotalValid] = useState(0);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);

  // Task list filters & pagination
  const [currentYear, setCurrentYear] = useState(() => {
    const [y] = getTodayIST().split('-').map(Number);
    return y;
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const [, m] = getTodayIST().split('-').map(Number);
    return m;
  });
  const [filterAssignee, setFilterAssignee] = useState<string>('all'); // 'all' | 'everyone' | teammateId
  const [currentPage, setCurrentPage] = useState(0);

  // Task list data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalTaskCount, setTotalTaskCount] = useState(0);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Delete modal state
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Map teammates by ID and by lowercase email
  const teammatesById = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const t of teammates) {
      map[t.id] = t;
    }
    return map;
  }, [teammates]);

  const teammatesByEmail = useMemo(() => {
    const map: Record<string, { id: string; name: string | null; email: string | null }> = {};
    for (const t of teammates) {
      if (t.email) {
        map[t.email.toLowerCase()] = {
          id: t.id,
          name: t.name,
          email: t.email,
        };
      }
    }
    return map;
  }, [teammates]);

  // Load teammates
  useEffect(() => {
    async function loadTeammates() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, role, email')
          .eq('role', 'teammate')
          .order('name', { ascending: true });

        if (error) throw error;
        setTeammates(data || []);
      } catch (err) {
        console.error('Error fetching teammates:', err);
      } finally {
        setTeammatesLoading(false);
      }
    }
    loadTeammates();
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
  }, [refreshKey]);

  // Compute month range for task list filter
  const daysInMonth = useMemo(() => {
    return getMonthDays(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  const firstDayOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const lastDayOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(
    daysInMonth.length
  ).padStart(2, '0')}`;

  // Load filtered & paginated tasks
  useEffect(() => {
    let ignore = false;

    async function fetchTasks() {
      try {
        let query = supabase
          .from('tasks')
          .select('*', { count: 'exact' })
          .gte('date', firstDayOfMonth)
          .lte('date', lastDayOfMonth);

        if (filterAssignee === 'everyone') {
          query = query.is('assigned_to', null);
        } else if (filterAssignee !== 'all') {
          query = query.eq('assigned_to', filterAssignee);
        }

        query = query
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

        const { data, error, count } = await query;

        if (!ignore) {
          if (error) {
            setTasksError(error.message);
          } else {
            setTasks(data || []);
            setTotalTaskCount(count || 0);
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
    }

    fetchTasks();

    return () => {
      ignore = true;
    };
  }, [firstDayOfMonth, lastDayOfMonth, filterAssignee, currentPage, refreshKey]);

  // Client-side search filtering
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase().trim();
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, searchQuery]);

  // Handle Add Task form submission
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(null);
    setFormError(null);

    const titleTrimmed = taskTitle.trim();
    if (!titleTrimmed) {
      setFormError('Please enter a task title.');
      return;
    }

    setSubmittingTask(true);

    try {
      const assignedToId = taskAssignee ? taskAssignee : null;

      if (repeatDaily) {
        const count = Math.max(1, Math.min(repeatDays || 365, 3650));
        const [year, month, day] = taskDate.split('-').map(Number);

        // Generate rows
        const rows: { date: string; title: string; assigned_to: string | null }[] = [];
        for (let i = 0; i < count; i++) {
          const d = new Date(Date.UTC(year, month - 1, day + i));
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, '0');
          const dt = String(d.getUTCDate()).padStart(2, '0');
          rows.push({
            date: `${y}-${m}-${dt}`,
            title: titleTrimmed,
            assigned_to: assignedToId,
          });
        }

        // Batch insert in chunks of 500
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const { error: insertError } = await supabase.from('tasks').insert(batch);
          if (insertError) throw insertError;
        }

        setFormSuccess(`Successfully scheduled ${count} daily recurring tasks!`);
      } else {
        // Single row insert
        const { error: insertError } = await supabase.from('tasks').insert({
          date: taskDate,
          title: titleTrimmed,
          assigned_to: assignedToId,
        });

        if (insertError) throw insertError;
        setFormSuccess('Task created successfully!');
      }

      setTaskTitle('');
      setRepeatDaily(false);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create task.';
      setFormError(msg);
    } finally {
      setSubmittingTask(false);
    }
  };

  // Handle CSV file selection and parsing
  const handleCSVChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCsvSuccess(null);
    setCsvErrorSummary(null);

    if (!file) {
      setCsvFile(null);
      setCsvRows([]);
      setCsvHasErrors(false);
      return;
    }

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parseResult = parseAndValidateCSV(text, teammatesByEmail);
      setCsvRows(parseResult.rows);
      setCsvHasErrors(parseResult.hasErrors);
      setCsvTotalValid(parseResult.totalValid);
      setCsvErrorSummary(parseResult.errorSummary);
    };
    reader.readAsText(file);
  };

  // Confirm and batch-insert CSV rows
  const handleConfirmCSV = async () => {
    if (csvRows.length === 0 || csvHasErrors) return;

    setImportingCsv(true);
    setCsvErrorSummary(null);

    try {
      const rowsToInsert = csvRows.map((r) => ({
        date: r.date,
        title: r.title,
        assigned_to: r.assigned_to,
      }));

      // Insert in batches of 500
      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('tasks').insert(batch);
        if (error) throw error;
      }

      setCsvSuccess(`Successfully imported ${rowsToInsert.length} tasks from CSV!`);
      setCsvFile(null);
      setCsvRows([]);
      setCsvHasErrors(false);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'CSV import failed.';
      setCsvErrorSummary(msg);
    } finally {
      setImportingCsv(false);
    }
  };

  // Handle task deletion
  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskToDelete.id);
      if (error) throw error;

      setTaskToDelete(null);
      if (tasks.length === 1 && currentPage > 0) {
        setCurrentPage((p) => p - 1);
      }
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete task.';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentPage(0);
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setCurrentPage(0);
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const totalPages = Math.ceil(totalTaskCount / PAGE_SIZE) || 1;

  return (
    <DashboardShell
      searchPlaceholder="Search tasks by title..."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      pendingCount={pendingCount}
    >
      <div className="space-y-8">
        {/* Creation Card: Direct / Repeat vs CSV Tabs */}
        <Card stagger={1} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2F353D]">
            <div>
              <span className="text-[10px] tracking-[0.2em] font-medium text-[#9AA3AE] uppercase block mb-1">
                TASK CREATOR
              </span>
              <h2 className="font-serif text-2xl font-light text-[#D9DEE5]">
                Schedule New Tasks
              </h2>
            </div>

            {/* Pill Tab Switcher */}
            <div className="inline-flex items-center p-1 rounded-full bg-[#252A31] border border-[#2F353D] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  activeTab === 'single'
                    ? 'bg-[#FF3B30] text-white shadow-[0_0_12px_rgba(255,59,48,0.4)]'
                    : 'text-[#9AA3AE] hover:text-[#D9DEE5]'
                }`}
              >
                Direct / Repeat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('csv')}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                  activeTab === 'csv'
                    ? 'bg-[#FF3B30] text-white shadow-[0_0_12px_rgba(255,59,48,0.4)]'
                    : 'text-[#9AA3AE] hover:text-[#D9DEE5]'
                }`}
              >
                CSV Upload
              </button>
            </div>
          </div>

          {activeTab === 'single' ? (
            /* Single Task & Repeat Form */
            <form onSubmit={handleCreateTask} className="space-y-5">
              {formError && <Toast type="error" message={formError} />}
              {formSuccess && <Toast type="success" message={formSuccess} />}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-[#9AA3AE] mb-1.5">
                    Date (IST)
                  </label>
                  <input
                    type="date"
                    required
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#2F353D] bg-[#252A31] px-3.5 py-2.5 text-xs text-[#D9DEE5] focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] focus:outline-none transition-all [color-scheme:dark]"
                  />
                </div>

                {/* Task Title */}
                <div>
                  <label className="block text-xs font-medium text-[#9AA3AE] mb-1.5">
                    Task Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inspect floor inventory"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#2F353D] bg-[#252A31] px-3.5 py-2.5 text-xs text-[#D9DEE5] placeholder-[#9AA3AE]/40 focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] focus:outline-none transition-all"
                  />
                </div>

                {/* Assignee */}
                <div>
                  <label className="block text-xs font-medium text-[#9AA3AE] mb-1.5">
                    Assignee
                  </label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#2F353D] bg-[#252A31] px-3.5 py-2.5 text-xs text-[#D9DEE5] focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] focus:outline-none transition-all [color-scheme:dark]"
                  >
                    <option value="">Everyone (Unassigned)</option>
                    {teammates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || t.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Repeat Daily Option */}
              <div className="pt-4 border-t border-[#2F353D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={repeatDaily}
                    onChange={(e) => setRepeatDaily(e.target.checked)}
                    className="w-4 h-4 rounded border-[#2F353D] bg-[#252A31] text-[#FF3B30] focus:ring-[#FF3B30] accent-[#FF3B30]"
                  />
                  <span className="text-xs font-medium text-[#D9DEE5]">
                    Repeat daily (bulk generate)
                  </span>
                </label>

                {repeatDaily && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9AA3AE]">Number of days:</span>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={repeatDays}
                      onChange={(e) => setRepeatDays(parseInt(e.target.value, 10) || 1)}
                      className="w-24 min-h-[38px] rounded-xl border border-[#2F353D] bg-[#252A31] px-3 py-1.5 text-xs text-[#D9DEE5] focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] focus:outline-none"
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  loading={submittingTask}
                  className="sm:ml-auto"
                >
                  {repeatDaily ? `Create ${repeatDays} Daily Tasks` : 'Create Task'}
                </Button>
              </div>
            </form>
          ) : (
            /* CSV Upload & Preview */
            <div className="space-y-5">
              {csvSuccess && <Toast type="success" message={csvSuccess} />}
              {csvErrorSummary && <Toast type="error" message={csvErrorSummary} />}

              <div className="space-y-2">
                <label
                  htmlFor={fileInputId}
                  className="group relative w-full p-8 rounded-2xl border-2 border-dashed border-[#2F353D] hover:border-[#FF3B30] bg-[#252A31]/40 hover:bg-[#252A31]/70 transition-all flex flex-col items-center justify-center text-center cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-[#1C1F24] border border-[#2F353D] flex items-center justify-center mb-3 group-hover:scale-105 group-hover:border-[#FF3B30] transition-all">
                    <svg className="w-5 h-5 text-[#9AA3AE] group-hover:text-[#FF3B30] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-[#D9DEE5] block mb-1">
                    {csvFile ? csvFile.name : 'Choose CSV file to upload'}
                  </span>
                  <span className="text-[11px] text-[#9AA3AE]">
                    Columns required: <code className="bg-[#1C1F24] px-1.5 py-0.5 rounded text-[#D9DEE5] border border-[#2F353D]">date,title,assigned_email</code>
                  </span>
                </label>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCSVChange}
                  className="sr-only"
                />
              </div>

              {/* CSV Preview Table */}
              {csvRows.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between text-xs text-[#9AA3AE]">
                    <span>
                      Preview: {csvRows.length} rows ({csvTotalValid} valid)
                    </span>
                    {csvHasErrors ? (
                      <span className="text-[#FF3B30] font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]" />
                        Errors detected. Fix rows before confirming.
                      </span>
                    ) : (
                      <span className="text-[#34C759] font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                        All rows validated.
                      </span>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-xl border border-[#2F353D] bg-[#14171B]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-[#252A31] border-b border-[#2F353D] text-[11px] font-medium tracking-wide uppercase text-[#9AA3AE]">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Title</th>
                          <th className="p-3">Assignee Email</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2F353D]">
                        {csvRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={row.error ? 'bg-[#FF3B30]/10' : 'hover:bg-[#252A31]/40'}
                          >
                            <td className="p-3 font-mono text-[11px] text-[#D9DEE5]">{row.date}</td>
                            <td className="p-3 text-[#D9DEE5]">{row.title}</td>
                            <td className="p-3 text-[#9AA3AE]">
                              {row.assigned_email || <span className="italic">Everyone</span>}
                            </td>
                            <td className="p-3">
                              {row.error ? (
                                <span className="text-[#FF3B30] font-medium">{row.error}</span>
                              ) : (
                                <span className="text-[#34C759] font-medium">Valid</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvRows([]);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      variant="primary"
                      disabled={csvHasErrors || importingCsv || csvRows.length === 0}
                      loading={importingCsv}
                      onClick={handleConfirmCSV}
                    >
                      Confirm & Import {csvRows.length} Tasks
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Task List Section */}
        <Card stagger={2} className="space-y-6">
          {/* Header & Month/Assignee Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2F353D]">
            <div>
              <span className="text-[10px] tracking-[0.2em] font-medium text-[#9AA3AE] uppercase block mb-1">
                SCHEDULED TASKS
              </span>
              <div className="flex items-center gap-3">
                <h2 className="font-serif text-2xl font-light text-[#D9DEE5]">
                  {formatMonthYear(currentYear, currentMonth - 1)}
                </h2>
                <span className="text-xs text-[#9AA3AE]">
                  ({totalTaskCount} total)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Assignee Filter Dropdown */}
              <select
                value={filterAssignee}
                onChange={(e) => {
                  setFilterAssignee(e.target.value);
                  setCurrentPage(0);
                }}
                className="min-h-[38px] rounded-xl border border-[#2F353D] bg-[#252A31] px-3.5 py-1.5 text-xs text-[#D9DEE5] focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] focus:outline-none [color-scheme:dark]"
              >
                <option value="all">All Assignees</option>
                <option value="everyone">Unassigned (Everyone)</option>
                {teammates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.email}
                  </option>
                ))}
              </select>

              {/* Prev / Next Month Circular Buttons */}
              <div className="flex items-center gap-1.5">
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
          </div>

          {tasksLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : tasksError ? (
            <Toast type="error" message={tasksError} />
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              title={searchQuery ? 'No matching tasks' : 'No tasks scheduled'}
              description={
                searchQuery
                  ? `No tasks matching "${searchQuery}" in this view.`
                  : `There are no tasks scheduled for ${formatMonthYear(
                      currentYear,
                      currentMonth - 1
                    )} matching your filter.`
              }
            />
          ) : (
            <>
              {/* Desktop Table with Thin Row Dividers */}
              <div className="hidden sm:block overflow-x-auto rounded-[14px] border border-[#2F353D] bg-[#14171B]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#252A31] border-b border-[#2F353D] text-[11px] font-medium tracking-wide uppercase text-[#9AA3AE]">
                    <tr>
                      <th className="p-3.5 min-w-[120px]">Date</th>
                      <th className="p-3.5">Title</th>
                      <th className="p-3.5 min-w-[160px]">Assignee</th>
                      <th className="p-3.5 text-right min-w-[100px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F353D]">
                    {filteredTasks.map((task) => {
                      const assignee = task.assigned_to ? teammatesById[task.assigned_to] : null;
                      const isToday = task.date === todayDate;

                      return (
                        <tr key={task.id} className="hover:bg-[#252A31]/40 transition-colors">
                          <td className="p-3.5 font-mono text-[11px] text-[#D9DEE5]">
                            <span className="flex items-center gap-2">
                              {task.date}
                              {isToday && (
                                <span className="w-2 h-2 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]" />
                              )}
                            </span>
                          </td>
                          <td className="p-3.5 font-medium text-[#D9DEE5]">{task.title}</td>
                          <td className="p-3.5">
                            {assignee ? (
                              <Badge status="teammate" label={assignee.name || assignee.email || 'Teammate'} />
                            ) : (
                              <span className="text-[11px] text-[#9AA3AE] italic">Everyone</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setTaskToDelete(task)}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Dark Cards */}
              <div className="sm:hidden space-y-3">
                {filteredTasks.map((task) => {
                  const assignee = task.assigned_to ? teammatesById[task.assigned_to] : null;
                  const isToday = task.date === todayDate;

                  return (
                    <div
                      key={task.id}
                      className="p-4 rounded-xl bg-[#252A31] border border-[#2F353D] space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-[11px] text-[#9AA3AE] flex items-center gap-1.5">
                          {task.date}
                          {isToday && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]" />
                          )}
                        </span>
                        {assignee ? (
                          <Badge status="teammate" label={assignee.name || assignee.email || 'Teammate'} />
                        ) : (
                          <span className="text-[11px] text-[#9AA3AE] italic">Everyone</span>
                        )}
                      </div>

                      <p className="text-sm font-medium text-[#D9DEE5]">{task.title}</p>

                      <div className="pt-2 flex justify-end border-t border-[#2F353D]">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setTaskToDelete(task)}
                        >
                          Delete Task
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-[#9AA3AE] pt-3 border-t border-[#2F353D]">
                  <span>
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage === 0}
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!taskToDelete}
          onClose={() => setTaskToDelete(null)}
          eyebrow="CONFIRM REMOVAL"
          title="Delete Task"
          maxWidth="max-w-md"
        >
          {taskToDelete && (
            <div className="space-y-4">
              <p className="text-xs text-[#9AA3AE] leading-relaxed">
                Are you sure you want to permanently delete this task? Teammates will no longer be required to complete it.
              </p>

              <div className="p-3.5 rounded-xl bg-[#252A31] border border-[#2F353D] text-xs space-y-1">
                <p className="font-medium text-[#D9DEE5]">{taskToDelete.title}</p>
                <p className="text-[11px] text-[#9AA3AE]">Date: {formatISTDisplayDate(taskToDelete.date)}</p>
              </div>

              {deleteError && <Toast type="error" message={deleteError} />}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  disabled={deleting}
                  onClick={() => setTaskToDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  loading={deleting}
                  onClick={handleDeleteTask}
                >
                  Delete Permanently
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardShell>
  );
}

export default function AdminTasksPage() {
  return (
    <AuthGuard allowedRoles={['admin']}>
      <TasksManagementContent />
    </AuthGuard>
  );
}
