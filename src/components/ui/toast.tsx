'use client';

import React from 'react';

export interface ToastProps {
  type?: 'success' | 'error' | 'info' | 'pending';
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function Toast({
  type = 'info',
  message,
  onDismiss,
  className = '',
}: ToastProps) {
  let styles = '';
  let role = 'status';

  if (type === 'success') {
    styles = 'bg-[#34C759]/15 border-[#34C759]/35 text-[#D9DEE5]';
  } else if (type === 'error') {
    styles = 'bg-[#FF3B30]/15 border-[#FF3B30]/35 text-[#D9DEE5]';
    role = 'alert';
  } else if (type === 'pending') {
    styles = 'bg-[#FFB020]/15 border-[#FFB020]/35 text-[#D9DEE5]';
  } else {
    styles = 'bg-[#252A31] border-[#2F353D] text-[#D9DEE5]';
  }

  return (
    <div
      role={role}
      className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-center justify-between gap-3 shadow-md animate-toast-in ${styles} ${className}`}
    >
      <div className="flex items-center gap-2.5">
        {type === 'success' && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] shadow-[0_0_6px_#34C759] shrink-0" />
        )}
        {type === 'error' && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_6px_#FF3B30] shrink-0" />
        )}
        {type === 'pending' && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#FFB020] shadow-[0_0_6px_#FFB020] shrink-0" />
        )}
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-[#9AA3AE] hover:text-[#D9DEE5] p-1 text-sm leading-none"
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      )}
    </div>
  );
}
