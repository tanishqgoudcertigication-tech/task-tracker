import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLoading() {
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
            <div className="w-20 h-8 rounded-full bg-[#252A31]" />
            <div className="w-20 h-8 rounded-full bg-[#252A31]" />
          </div>
          <div className="w-8 h-8 rounded-full bg-[#252A31]" />
        </div>

        {/* 12-column dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-5 h-80 rounded-[18px]" />
          <Skeleton className="lg:col-span-4 h-80 rounded-[18px]" />
          <Skeleton className="lg:col-span-3 h-80 rounded-[18px]" />
          <Skeleton className="lg:col-span-12 h-96 rounded-[18px]" />
        </div>
      </div>
    </div>
  );
}
