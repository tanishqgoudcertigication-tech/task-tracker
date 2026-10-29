'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { supabase, Profile } from '@/lib/supabase';

function TeamManagementContent() {
  const [teammates, setTeammates] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search and notifications
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Remove confirmation modal state
  const [teammateToDelete, setTeammateToDelete] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch teammates
  useEffect(() => {
    let ignore = false;

    async function loadTeammates() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email, role')
          .eq('role', 'teammate')
          .order('name', { ascending: true });

        if (!ignore) {
          if (error) {
            setFetchError(error.message);
          } else {
            setTeammates(data || []);
            setFetchError(null);
          }
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch teammates.';
          setFetchError(msg);
          setLoading(false);
        }
      }
    }

    loadTeammates();

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

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

  // Client-side search filtering
  const filteredTeammates = useMemo(() => {
    if (!searchQuery.trim()) return teammates;
    const q = searchQuery.toLowerCase().trim();
    return teammates.filter(
      (tm) =>
        (tm.name && tm.name.toLowerCase().includes(q)) ||
        (tm.email && tm.email.toLowerCase().includes(q))
    );
  }, [teammates, searchQuery]);

  // Create teammate form submission
  const handleCreateTeammate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSuccess(null);
    setCreateError(null);

    if (!email.trim() || !password.trim()) {
      setCreateError('Email and password are required.');
      return;
    }

    if (password.length < 6) {
      setCreateError('Password must be at least 6 characters.');
      return;
    }

    setCreating(true);

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      if (!token) {
        setCreateError('Your session expired. Log in again.');
        return;
      }

      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = result?.error || 'Failed to create teammate account.';
        setCreateError(errorMsg);
        return;
      }

      setCreateSuccess(`Teammate "${name.trim() || email.trim()}" created successfully!`);
      setName('');
      setEmail('');
      setPassword('');

      // Refresh teammates list
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating teammate.';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  // Delete teammate submission
  const handleConfirmDelete = async () => {
    if (!teammateToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      if (!token) {
        setDeleteError('Your session expired. Log in again.');
        return;
      }

      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: teammateToDelete.id }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = result?.error || 'Failed to remove teammate.';
        setDeleteError(errorMsg);
        return;
      }

      setTeammateToDelete(null);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error removing teammate.';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardShell
      searchPlaceholder="Search teammates by name or email..."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      pendingCount={pendingCount}
    >
      <div className="space-y-8">
        {/* Create Teammate Form Card */}
        <Card stagger={1} className="space-y-6">
          <div className="border-b border-[#2F353D] pb-4">
            <span className="text-[10px] tracking-[0.2em] font-medium text-[#9AA3AE] uppercase block mb-1">
              ACCOUNT PROVISIONING
            </span>
            <h2 className="font-serif text-2xl font-light text-[#D9DEE5]">
              Add New Teammate
            </h2>
            <p className="text-xs text-[#9AA3AE] mt-1">
              Securely provisions an authenticated user and creates their profile.
            </p>
          </div>

          {createSuccess && (
            <Toast
              type="success"
              message={createSuccess}
              onDismiss={() => setCreateSuccess(null)}
            />
          )}
          {createError && <Toast type="error" message={createError} />}

          <form onSubmit={handleCreateTeammate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="tm-name" className="block text-xs font-medium text-[#9AA3AE] mb-1.5">
                  Full Name
                </label>
                <input
                  id="tm-name"
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#2F353D] bg-[#252A31] px-3.5 py-2.5 text-xs text-[#D9DEE5] placeholder-[#9AA3AE]/40 focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label htmlFor="tm-email" className="block text-xs font-medium text-[#9AA3AE] mb-1.5">
                  Email Address *
                </label>
                <input
                  id="tm-email"
                  type="email"
                  required
                  placeholder="rahul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#2F353D] bg-[#252A31] px-3.5 py-2.5 text-xs text-[#D9DEE5] placeholder-[#9AA3AE]/40 focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label htmlFor="tm-password" className="block text-xs font-medium text-[#9AA3AE] mb-1.5">
                  Temporary Password *
                </label>
                <input
                  id="tm-password"
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#2F353D] bg-[#252A31] px-3.5 py-2.5 text-xs text-[#D9DEE5] placeholder-[#9AA3AE]/40 focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button
                type="submit"
                variant="primary"
                loading={creating}
              >
                Create Account
              </Button>
            </div>
          </form>
        </Card>

        {/* Teammates List Card */}
        <Card stagger={2} className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#2F353D]">
            <div>
              <span className="text-[10px] tracking-[0.2em] font-medium text-[#9AA3AE] uppercase block mb-1">
                ROSTER
              </span>
              <h2 className="font-serif text-2xl font-light text-[#D9DEE5]">
                Active Teammates ({teammates.length})
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : fetchError ? (
            <Toast type="error" message={fetchError} />
          ) : filteredTeammates.length === 0 ? (
            <EmptyState
              title={searchQuery ? 'No matching teammates' : 'No teammates found'}
              description={
                searchQuery
                  ? `No teammates matching "${searchQuery}".`
                  : 'Use the form above to add your first teammate to the system.'
              }
            />
          ) : (
            <>
              {/* Desktop Table with Thin Row Dividers */}
              <div className="hidden sm:block overflow-x-auto rounded-[14px] border border-[#2F353D] bg-[#14171B]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#252A31] border-b border-[#2F353D] text-[11px] font-medium tracking-wide uppercase text-[#9AA3AE]">
                    <tr>
                      <th className="p-3.5 min-w-[180px]">Name</th>
                      <th className="p-3.5">Email Address</th>
                      <th className="p-3.5 min-w-[100px]">Role</th>
                      <th className="p-3.5 text-right min-w-[100px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2F353D]">
                    {filteredTeammates.map((tm) => {
                      const initial = (tm.name || tm.email || '?').charAt(0).toUpperCase();

                      return (
                        <tr key={tm.id} className="hover:bg-[#252A31]/40 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#252A31] border border-[#2F353D] flex items-center justify-center font-medium text-xs text-[#D9DEE5]">
                                {initial}
                              </div>
                              <span className="font-medium text-[#D9DEE5]">
                                {tm.name || <span className="italic text-[#9AA3AE]">No name set</span>}
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-[#9AA3AE]">
                            {tm.email || '—'}
                          </td>
                          <td className="p-3.5">
                            <Badge status="teammate" />
                          </td>
                          <td className="p-3.5 text-right">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setTeammateToDelete(tm)}
                            >
                              Remove
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
                {filteredTeammates.map((tm) => {
                  const initial = (tm.name || tm.email || '?').charAt(0).toUpperCase();

                  return (
                    <div
                      key={tm.id}
                      className="p-4 rounded-xl bg-[#252A31] border border-[#2F353D] space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#1C1F24] border border-[#2F353D] flex items-center justify-center font-medium text-xs text-[#D9DEE5]">
                            {initial}
                          </div>
                          <span className="font-medium text-sm text-[#D9DEE5]">
                            {tm.name || 'Unnamed teammate'}
                          </span>
                        </div>
                        <Badge status="teammate" />
                      </div>

                      <p className="font-mono text-xs text-[#9AA3AE] pl-10.5">{tm.email}</p>

                      <div className="pt-2 flex justify-end border-t border-[#2F353D]">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setTeammateToDelete(tm)}
                        >
                          Remove Teammate
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!teammateToDelete}
          onClose={() => setTeammateToDelete(null)}
          eyebrow="CONFIRM REMOVAL"
          title="Remove Teammate"
          maxWidth="max-w-md"
        >
          {teammateToDelete && (
            <div className="space-y-4">
              <p className="text-xs text-[#9AA3AE] leading-relaxed">
                Are you sure you want to remove <strong className="text-[#D9DEE5] font-semibold">{teammateToDelete.name || teammateToDelete.email}</strong>? This action permanently revokes their login access and deletes their profile.
              </p>

              <div className="p-3 rounded-xl bg-[#252A31] border border-[#2F353D] text-xs font-mono text-[#9AA3AE]">
                ID: {teammateToDelete.id}
              </div>

              {deleteError && <Toast type="error" message={deleteError} />}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  disabled={deleting}
                  onClick={() => setTeammateToDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  loading={deleting}
                  onClick={handleConfirmDelete}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardShell>
  );
}

export default function AdminTeamPage() {
  return (
    <AuthGuard allowedRoles={['admin']}>
      <TeamManagementContent />
    </AuthGuard>
  );
}
