'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getCurrentProfile } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';

let introSeenListeners: Array<() => void> = [];
function notifyIntroSeen() {
  introSeenListeners.forEach((l) => l());
}

function useIntroSeen(): boolean {
  return useSyncExternalStore(
    (callback) => {
      introSeenListeners.push(callback);
      return () => {
        introSeenListeners = introSeenListeners.filter((l) => l !== callback);
      };
    },
    () => {
      if (typeof window === 'undefined') return false;
      try {
        return sessionStorage.getItem('introSeen') === 'true';
      } catch {
        return false;
      }
    },
    () => false
  );
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      media.addEventListener('change', callback);
      return () => media.removeEventListener('change', callback);
    },
    () => {
      if (typeof window === 'undefined' || !window.matchMedia) return false;
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    () => false
  );
}

interface IntroExperienceProps {
  mode?: 'intro' | 'login';
}

export function IntroExperience({ mode = 'intro' }: IntroExperienceProps) {
  const router = useRouter();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();

  const isLoginMode = mode === 'login';
  const introSeen = useIntroSeen();
  const prefersReducedMotion = usePrefersReducedMotion();

  // Settled state: derived from login mode, repeat visit, reduced motion, or timeline finish
  const [animationFinished, setAnimationFinished] = useState(false);
  const [replayCount, setReplayCount] = useState(0);

  const isSettled = isLoginMode || introSeen || prefersReducedMotion || animationFinished;

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Focus email when settled or timer completes at 4.5s
  useEffect(() => {
    if (isSettled) {
      const timer = setTimeout(() => {
        emailInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }

    // Normal play: timeline completes at 4.5s, focus email
    const timer = setTimeout(() => {
      setAnimationFinished(true);
      try {
        sessionStorage.setItem('introSeen', 'true');
        notifyIntroSeen();
      } catch {
        // ignore
      }
      emailInputRef.current?.focus();
    }, 4500);

    return () => clearTimeout(timer);
  }, [isSettled, replayCount]);

  // Redirect if logged in
  useEffect(() => {
    if (!authLoading && user && profile) {
      if (profile.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/today');
      }
    }
  }, [authLoading, user, profile, router]);

  // Handle Skip Trigger (shows login card immediately)
  const handleSkip = useCallback((reason?: string) => {
    void reason;
    setAnimationFinished(true);
    try {
      sessionStorage.setItem('introSeen', 'true');
      notifyIntroSeen();
    } catch {
      // ignore
    }
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 50);
  }, []);

  // Replay Intro: clears sessionStorage and re-runs animation
  const handleReplayIntro = useCallback(() => {
    try {
      sessionStorage.removeItem('introSeen');
      notifyIntroSeen();
    } catch {
      // ignore
    }
    setAnimationFinished(false);
    setReplayCount((c) => c + 1);
  }, []);

  // Keyboard shortcut listener: Esc, Enter, Space skips intro when it's playing
  useEffect(() => {
    if (isSettled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSkip('keyboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettled, handleSkip]);

  // Form submit handler
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setSubmitting(false);
        return;
      }

      if (data.user) {
        router.prefetch('/today');
        router.prefetch('/admin');

        const { profile: userProfile, error: profileErr } =
          await getCurrentProfile();
        await refreshProfile();

        const destination =
          !profileErr && userProfile?.role === 'admin' ? '/admin' : '/today';

        router.prefetch(destination);
        router.replace(destination);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMsg(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#0F1215] text-[#D9DEE5] overflow-x-hidden flex items-center justify-center p-4 sm:p-6 lg:p-12 selection:bg-[#FF3B30]/30 selection:text-[#D9DEE5]">
      {/* Background Hexagon Pattern (inline SVG) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
        <defs>
          <pattern
            id="hex-pattern"
            width="40"
            height="69.282"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 20 11.547 L 0 0 L 0 23.094 L 20 34.641 L 40 23.094 Z M 0 34.641 L 20 46.188 L 40 34.641 L 40 57.735 L 20 69.282 L 0 57.735 Z"
              stroke="#1A1F25"
              strokeWidth="1"
              fill="none"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex-pattern)" />
      </svg>

      {/* Soft Signal Red Glow in top right corner */}
      <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-[#FF3B30]/[0.06] blur-[140px] pointer-events-none" />

      {/* Skip Intro Pill (top right) */}
      {!isSettled && (
        <button
          type="button"
          onClick={() => handleSkip('skip-button')}
          className="fixed top-5 right-5 z-50 px-3.5 py-1.5 rounded-full bg-[#171A1F]/90 hover:bg-[#1F242B] border border-[#2A3038] text-[11px] font-medium text-[#E6EAF0] tracking-wide transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-lg backdrop-blur-md"
        >
          Skip intro →
        </button>
      )}

      {/* Main 3-Section Layout */}
      <div
        key={replayCount}
        onClick={!isSettled ? () => handleSkip('click') : undefined}
        className={`relative z-10 w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 lg:gap-12 py-8 ${
          isSettled ? 'scene-settled' : 'scene-animated'
        }`}
      >
        {/* 1. Left Column: Eyebrow, Title, Tagline, and Streak Medallion */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left gap-6 max-w-sm">
          {/* Title Block */}
          <div className="intro-title-block space-y-2">
            <span className="text-[11px] font-semibold tracking-[0.2em] text-[#FF5A4F] uppercase">
              Track, prove, repeat
            </span>
            <h1 className="font-sans text-4xl sm:text-5xl lg:text-[54px] font-medium leading-[1.08] tracking-[0.03em] text-[#E6EAF0]">
              Task
              <br />
              Tracker
            </h1>
            <p className="text-sm sm:text-base text-[#8B94A1] pt-1">
              Show up every day. Finish what you start.
            </p>
          </div>

          {/* Round Streak Medallion (176px) */}
          <div className="relative w-[176px] h-[176px] intro-medallion my-2">
            {/* Orbiting dots: 10s linear loop, hidden on mobile */}
            <div className="intro-orbit-ring absolute -inset-3.5 pointer-events-none hidden md:block">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#FF3B30] shadow-[0_0_8px_#FF3B30]" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#E6EAF0] shadow-[0_0_8px_#E6EAF0]" />
            </div>

            {/* Medallion Disc */}
            <div className="w-[176px] h-[176px] rounded-full bg-[#171A1F] border border-[#2A3038] shadow-2xl flex flex-col items-center justify-center p-3 select-none">
              {/* 5 by 4 Grid of Small Rounded Squares */}
              <div className="grid grid-cols-5 gap-1.5 p-1">
                {Array.from({ length: 20 }).map((_, idx) => {
                  const isToday = idx === 19;
                  return (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-[3px] transition-all ${
                        isToday
                          ? 'bg-[#252A31] intro-today-cell'
                          : 'bg-[#252A31] intro-streak-cell'
                      }`}
                      style={{
                        ['--cell-idx' as string]: idx,
                      }}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] text-[#8B94A1] tracking-wider uppercase font-medium mt-2">
                365 day streak
              </span>
            </div>
          </div>
        </div>

        {/* 2. Middle Column: Task Cards & Daily Submission */}
        <div className="flex flex-col gap-3 w-full max-w-[280px]">
          {/* Task 1 */}
          <div className="intro-task-card intro-task-1 bg-[#1F242B] border border-[#2A3038] rounded-[10px] p-3.5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="intro-check intro-check-1 w-5 h-5 rounded-full border border-[#2A3038] flex items-center justify-center transition-colors">
                <svg
                  className="w-3 h-3 stroke-[2.5]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#E6EAF0]">
                Stand-up notes
              </span>
            </div>
            <span className="text-[10px] text-[#8B94A1]">9:00 AM</span>
          </div>

          {/* Task 2 */}
          <div className="intro-task-card intro-task-2 bg-[#1F242B] border border-[#2A3038] rounded-[10px] p-3.5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="intro-check intro-check-2 w-5 h-5 rounded-full border border-[#2A3038] flex items-center justify-center transition-colors">
                <svg
                  className="w-3 h-3 stroke-[2.5]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#E6EAF0]">
                Client follow-ups
              </span>
            </div>
            <span className="text-[10px] text-[#8B94A1]">11:30 AM</span>
          </div>

          {/* Task 3 */}
          <div className="intro-task-card intro-task-3 bg-[#1F242B] border border-[#2A3038] rounded-[10px] p-3.5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="intro-check intro-check-3 w-5 h-5 rounded-full border border-[#2A3038] flex items-center justify-center transition-colors">
                <svg
                  className="w-3 h-3 stroke-[2.5]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <span className="text-xs font-medium text-[#E6EAF0]">
                Weekly report
              </span>
            </div>
            <span className="text-[10px] text-[#8B94A1]">2:00 PM</span>
          </div>

          {/* Daily Submission Card */}
          <div className="intro-proof-card bg-[#E6EAF0] text-[#0F1215] rounded-[10px] p-3 shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-md bg-[#1C1F24] overflow-hidden flex items-center justify-center relative border border-white/20">
                <svg
                  className="w-5 h-5 text-[#8B94A1]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#0F1215]">
                  Daily submission
                </p>
                <p className="text-[9px] text-[#4A5058]">
                  Verified daily completion
                </p>
              </div>
            </div>
            <div className="intro-approved-badge flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#34D399]/20 border border-[#34D399]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
              <span className="text-[11px] font-bold text-[#059669] tracking-wide">
                Approved
              </span>
            </div>
          </div>
        </div>

        {/* 3. Right Column: Login Card */}
        <div className="intro-login-card w-full max-w-[380px] bg-[#171A1F]/[0.92] backdrop-blur-[12px] border border-[#2A3038] border-t-2 border-t-[#FF3B30] rounded-[18px] p-6 sm:p-7 shadow-2xl transition-all duration-300">
          {/* Header */}
          <div className="mb-6 space-y-1">
            <h2 className="font-serif text-3xl font-light text-[#E6EAF0] tracking-tight">
              Welcome back
            </h2>
            <p className="text-xs text-[#8B94A1]">
              Log in to see today&apos;s tasks.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <p className="text-xs text-[#FF3B30] flex items-center gap-1.5 p-2 rounded-lg bg-[#FF3B30]/10 border border-[#FF3B30]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]" />
                <span>{errorMsg}</span>
              </p>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-medium text-[#8B94A1] mb-1.5"
              >
                Email address
              </label>
              <input
                ref={emailInputRef}
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                spellCheck="false"
                enterKeyHint="next"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="block w-full min-h-[44px] rounded-xl border border-[#2A3038] bg-[#1F242B] px-3.5 py-2.5 text-xs text-[#E6EAF0] placeholder-[#8B94A1]/40 shadow-xs focus:border-[#FF3B30] focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/40 focus:shadow-[0_0_12px_rgba(255,59,48,0.25)] transition-colors"
              />
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-[#8B94A1] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  enterKeyHint="done"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full min-h-[44px] rounded-xl border border-[#2A3038] bg-[#1F242B] px-3.5 py-2.5 pr-10 text-xs text-[#E6EAF0] placeholder-[#8B94A1]/40 shadow-xs focus:border-[#FF3B30] focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/40 focus:shadow-[0_0_12px_rgba(255,59,48,0.25)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#8B94A1] hover:text-[#E6EAF0] transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Silver "Log in" pill button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] rounded-full bg-[#E6EAF0] text-[#0F1215] text-xs font-semibold hover:bg-white active:scale-[0.98] disabled:opacity-60 transition-all duration-150 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#0F1215]/30 border-t-[#0F1215] rounded-full animate-spin" />
                    <span>Logging in...</span>
                  </>
                ) : (
                  <span>Log in</span>
                )}
              </button>
            </div>

            {/* Admin notice */}
            <div className="pt-1 text-center">
              <p className="text-xs text-[#8B94A1]">
                No account? Ask your admin to add you.
              </p>
            </div>

            {/* Replay intro text link */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleReplayIntro}
                className="text-[11px] text-[#8B94A1] hover:text-[#E6EAF0] underline underline-offset-2 transition-colors cursor-pointer"
              >
                Replay intro
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
