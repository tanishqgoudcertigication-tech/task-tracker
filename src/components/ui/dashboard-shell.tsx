'use client';

import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { NotificationBellDropdown } from '@/components/ui/notifications-dropdown';

interface DashboardShellProps {
  children: ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  pendingCount?: number;
  onNotificationClick?: () => void;
}

const ADMIN_NAV = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Tasks', href: '/admin/tasks' },
  { label: 'Team', href: '/admin/team' },
  { label: 'Reports', href: '/admin/reports' },
];

const TEAMMATE_NAV = [
  { label: 'Today', href: '/today' },
  { label: 'Calendar', href: '/calendar' },
];

export function DashboardShell({
  children,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  pendingCount = 0,
  onNotificationClick,
}: DashboardShellProps) {
  void pendingCount;
  void onNotificationClick;
  const pathname = usePathname();
  const { profile, user, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const navItems = isAdmin ? ADMIN_NAV : TEAMMATE_NAV;

  const displayName = profile?.name || profile?.email || user?.email || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
  };

  return (
    <div className="min-h-screen bg-[#14171B] bg-[radial-gradient(ellipse_90%_50%_at_50%_-15%,rgba(55,62,72,0.3),rgba(20,23,27,1))] text-[#D9DEE5] flex flex-col p-3 sm:p-5 lg:p-7 selection:bg-[#FF3B30]/30 selection:text-white">
      {/* Top bar inside a sleek rounded container */}
      <header className="w-full max-w-7xl mx-auto bg-[#1C1F24] border border-[#2F353D] rounded-2xl sm:rounded-full px-4 sm:px-6 py-2.5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 sticky top-3 sm:top-5 z-40 backdrop-blur-md">
        {/* Left: Logo mark with app name */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <Link
            href={isAdmin ? '/admin' : '/today'}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-full bg-[#252A31] border border-[#2F353D] flex items-center justify-center font-bold text-xs text-[#D9DEE5] group-hover:border-[#FF3B30] transition-colors relative">
              <span className="text-[#FF3B30]">T</span>
              <span>T</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] absolute -top-0.5 -right-0.5 shadow-[0_0_6px_#FF3B30]" />
            </div>
            <span className="font-medium text-sm tracking-tight text-[#D9DEE5] group-hover:text-white transition-colors">
              Task Tracker
            </span>
          </Link>

          {/* Mobile bell & avatar on right of logo row */}
          <div className="flex items-center gap-2 md:hidden">
            <NotificationBellDropdown />
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-8 h-8 rounded-full bg-[#252A31] border border-[#2F353D] text-xs font-semibold text-[#D9DEE5]"
            >
              {loggingOut ? '...' : initial}
            </button>
          </div>
        </div>

        {/* Center: Pill-shaped nav tabs */}
        <nav
          className="flex items-center gap-1.5 overflow-x-auto max-w-full no-scrollbar"
          aria-label="Dashboard Navigation"
        >
          {navItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-150 whitespace-nowrap select-none ${
                  isActive
                    ? 'bg-[#2F353D] text-white shadow-xs'
                    : 'text-[#9AA3AE] hover:text-[#D9DEE5] hover:bg-[#252A31]'
                }`}
              >
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]" />
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Rounded search input, notification bell with red badge, and circular avatar */}
        <div className="hidden md:flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <svg
              className="w-3.5 h-3.5 text-[#9AA3AE] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue || ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="bg-[#252A31] border border-[#2F353D] rounded-full pl-8 pr-3 py-1.5 text-xs text-[#D9DEE5] placeholder-[#9AA3AE]/60 w-44 lg:w-56 focus:border-[#FF3B30] focus:ring-1 focus:ring-[#FF3B30] focus:outline-none transition-all"
            />
          </div>

          {/* Notification Bell with red badge & dropdown */}
          <NotificationBellDropdown />

          {/* Circular avatar menu with logout */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="Open user menu"
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-[#252A31] border border-[#2F353D] hover:border-[#3E4550] transition-all cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-[#1C1F24] border border-[#3E4550] flex items-center justify-center text-[10px] font-bold text-[#D9DEE5]">
                {initial}
              </div>
              <span className="text-xs font-medium text-[#D9DEE5] max-w-[100px] truncate">
                {displayName}
              </span>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#1C1F24] border border-[#2F353D] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-[#2F353D] mb-1">
                  <p className="text-xs font-semibold text-[#D9DEE5] truncate">{displayName}</p>
                  <p className="text-[10px] text-[#9AA3AE] capitalize">{profile?.role || 'User'}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg flex items-center justify-between transition-colors"
                >
                  <span>{loggingOut ? 'Signing out...' : 'Log out'}</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 12-Column Content Layout (stacks to 1 column on mobile) */}
      <div className={`w-full max-w-7xl mx-auto flex-1 mt-6 ${!isAdmin ? 'pb-20 sm:pb-0' : ''}`}>
        {children}
      </div>

      {/* Teammates Mobile Frosted Bottom Nav */}
      {!isAdmin && (
        <nav
          aria-label="Mobile Navigation"
          className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1C1F24]/95 backdrop-blur-md border-t border-[#2F353D] px-6 py-2.5 flex items-center justify-around shadow-2xl"
        >
          <Link
            href="/today"
            className={`flex flex-col items-center gap-1 min-w-[56px] py-1 transition-colors ${
              pathname === '/today' ? 'text-white font-semibold' : 'text-[#9AA3AE]'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[11px] flex items-center gap-1">
              Today
              {pathname === '/today' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]" />
              )}
            </span>
          </Link>

          <Link
            href="/calendar"
            className={`flex flex-col items-center gap-1 min-w-[56px] py-1 transition-colors ${
              pathname === '/calendar' ? 'text-white font-semibold' : 'text-[#9AA3AE]'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[11px] flex items-center gap-1">
              Calendar
              {pathname === '/calendar' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30]" />
              )}
            </span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex flex-col items-center gap-1 min-w-[56px] py-1 text-[#9AA3AE] hover:text-[#FF3B30]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H3" />
            </svg>
            <span className="text-[11px]">{loggingOut ? '...' : 'Log out'}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
