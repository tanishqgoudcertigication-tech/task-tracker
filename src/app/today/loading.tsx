import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function TodayLoading() {
  return (
    <div className="min-h-screen bg-[#14171B] text-[#D9DEE5]">
      {/* Shell header skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8 space-y-6">
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

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left checklist & submission column (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 rounded-[18px] bg-[#1C1F24] border border-[#2F353D] space-y-6">
              <div className="space-y-2 pb-4 border-b border-[#2F353D]">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-80" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          </div>

          {/* Right sidebar stats column (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-[18px] bg-[#1C1F24] border border-[#2F353D] space-y-6">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
