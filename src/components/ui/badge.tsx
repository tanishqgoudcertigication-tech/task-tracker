'use client';

import React from 'react';

export type StatusType =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'missed'
  | 'past_empty'
  | 'future'
  | 'admin'
  | 'teammate';

interface BadgeProps {
  status: StatusType | string;
  label?: string;
  showIcon?: boolean;
  className?: string;
}

export function Badge({
  status,
  label,
  showIcon = true,
  className = '',
}: BadgeProps) {
  let displayLabel = label;
  let colorStyles = '';
  let icon = null;

  switch (status) {
    case 'approved':
      displayLabel = label || 'Approved';
      colorStyles = 'text-[#34C759] bg-[#34C759]/15 border-[#34C759]/35';
      icon = (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
      );
      break;

    case 'pending':
      displayLabel = label || 'Pending Review';
      colorStyles = 'text-[#FFB020] bg-[#FFB020]/15 border-[#FFB020]/35';
      icon = (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7v5l3 2" />
        </svg>
      );
      break;

    case 'rejected':
      displayLabel = label || 'Rejected';
      colorStyles = 'text-[#FF3B30] bg-[#FF3B30]/15 border-[#FF3B30]/35';
      icon = (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
      break;

    case 'missed':
      displayLabel = label || 'Missed';
      colorStyles = 'text-[#FF3B30] bg-[#FF3B30]/15 border-[#FF3B30]/35';
      icon = (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
        </svg>
      );
      break;

    case 'past_empty':
      displayLabel = label || 'No Submission';
      colorStyles = 'text-[#9AA3AE] bg-[#252A31] border-[#2F353D]';
      icon = (
        <span className="w-1.5 h-1.5 rounded-full bg-[#9AA3AE]/60 shrink-0" />
      );
      break;

    case 'future':
      displayLabel = label || 'Upcoming';
      colorStyles = 'text-[#9AA3AE] bg-transparent border-[#2F353D]';
      icon = (
        <span className="w-1.5 h-1.5 rounded-full border border-[#9AA3AE] shrink-0" />
      );
      break;

    case 'admin':
      displayLabel = label || 'Admin';
      colorStyles = 'text-[#D9DEE5] bg-[#252A31] border-[#2F353D] font-semibold';
      break;

    case 'teammate':
      displayLabel = label || 'Teammate';
      colorStyles = 'text-[#9AA3AE] bg-[#252A31] border-[#2F353D]';
      break;

    default:
      displayLabel = label || String(status);
      colorStyles = 'text-[#D9DEE5] bg-[#252A31] border-[#2F353D]';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-full border tracking-wide select-none ${colorStyles} ${className}`}
    >
      {showIcon && icon}
      <span>{displayLabel}</span>
    </span>
  );
}
