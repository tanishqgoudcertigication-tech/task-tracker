'use client';

import React, { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  stagger?: 1 | 2 | 3;
}

export function Card({
  stagger,
  className = '',
  children,
  ...props
}: CardProps) {
  const animClass =
    stagger === 1
      ? 'animate-fade-up-1'
      : stagger === 2
      ? 'animate-fade-up-2'
      : stagger === 3
      ? 'animate-fade-up-3'
      : '';

  return (
    <div
      className={`bg-[#1C1F24] rounded-[18px] border border-[#2F353D] text-[#D9DEE5] p-5 sm:p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] hover:border-[#3E4550] hover:shadow-[0_10px_35px_-8px_rgba(0,0,0,0.7)] transition-all duration-200 relative ${animClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
