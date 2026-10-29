'use client';

import React from 'react';

interface ProgressBarProps {
  value: number; // 0 to 100
  color?: string; // custom fill color, e.g. #34C759 or #FFB020
  hasRedTip?: boolean;
  className?: string;
  showPercent?: boolean;
}

export function ProgressBar({
  value,
  color,
  hasRedTip = true,
  className = '',
  showPercent = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {showPercent && (
        <div className="flex justify-between items-center text-[11px] text-[#9AA3AE]">
          <span>Progress</span>
          <span className="font-semibold text-[#D9DEE5]">{clamped}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full h-1.5 bg-[#252A31] rounded-full overflow-hidden relative border border-[#2F353D]/40"
      >
        <div
          className="h-full transition-all duration-300 ease-out relative"
          style={{
            width: `${clamped}%`,
            backgroundColor: color || '#D9DEE5',
          }}
        >
          {clamped > 0 && hasRedTip && !color && (
            <span
              className="absolute right-0 top-0 bottom-0 w-1.5 bg-[#FF3B30] shadow-[0_0_6px_#FF3B30] rounded-r-full"
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </div>
  );
}
