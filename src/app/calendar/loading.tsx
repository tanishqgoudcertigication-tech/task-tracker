import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CalendarLoading() {
  return (
    <div className="min-h-screen bg-[#14171B] text-[#D9DEE5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8 space-y-6">
        {/* Top shell bar skeleton */}
        <div className="h-14 w-full rounded-2xl bg-[#1C1F24] border border-[#2F353D] flex items-center justify-between px-4 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#252A31]" />
            <div className="w-24 h-4 rounded bg-[#252A31]" />
          </div>
          <div className="hidden sm:flex items-center space-x-2">
            <div className="w-20 h-8 rounded-full bg-[#252A31]" />
            <div className="w-20 h-8 rounded-full bg-[#252A31]" />
          </div>
          <div className="w-8 h-8 rounded-full bg-[#252A31]" />
        </div>

        {/* Page title */}
        <div className="space-y-1">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-60" />
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <Skeleton className="h-28 rounded-[18px]" />
          <Skeleton className="h-28 rounded-[18px]" />
          <Skeleton className="h-28 rounded-[18px]" />
          <Skeleton className="h-28 rounded-[18px]" />
        </div>

        {/* Calendar grid skeleton card */}
        <div className="p-6 rounded-[18px] bg-[#1C1F24] border border-[#2F353D] space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#2F353D]">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
