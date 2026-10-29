'use client';

import React, { HTMLAttributes } from 'react';

export function Skeleton({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-[#252A31] border border-[#2F353D] rounded-xl animate-pulse ${className}`}
      {...props}
    />
  );
}
