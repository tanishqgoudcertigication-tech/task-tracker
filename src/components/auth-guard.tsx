'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Role } from '@/lib/supabase';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Logged-out users go to /login
    if (!user) {
      router.replace('/login');
      return;
    }

    // Role-based restrictions
    if (allowedRoles && allowedRoles.length > 0) {
      // If user has no profile or role is not allowed
      if (!profile || !allowedRoles.includes(profile.role)) {
        // Teammates can never open /admin -> redirect to /today
        if (profile?.role === 'teammate') {
          router.replace('/today');
        } else {
          router.replace('/login');
        }
      }
    }
  }, [user, profile, loading, allowedRoles, router]);

  // Show clean minimal loader while resolving auth or if unauthorized on protected pages
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#14171B] p-4">
        <div className="w-6 h-6 border-2 border-[#2F353D] border-t-[#FF3B30] rounded-full animate-spin" />
      </div>
    );
  }

  // If role restriction is present and role doesn't match yet, keep showing spinner during redirect
  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#14171B] p-4">
        <div className="w-6 h-6 border-2 border-[#2F353D] border-t-[#FF3B30] rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
