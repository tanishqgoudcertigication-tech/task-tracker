'use client';

import React, { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`py-12 px-4 text-center flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      {icon ? (
        <div className="w-12 h-12 rounded-full border border-[#2F353D] bg-[#252A31] flex items-center justify-center text-[#9AA3AE] mb-1">
          {icon}
        </div>
      ) : (
        <div className="w-10 h-10 rounded-full border border-[#2F353D] bg-[#252A31] flex items-center justify-center text-[#9AA3AE] mb-1">
          <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 12H4" />
          </svg>
        </div>
      )}
      <h4 className="font-serif text-xl font-light text-[#D9DEE5] tracking-tight">
        {title}
      </h4>
      {description && (
        <p className="text-xs text-[#9AA3AE] max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
