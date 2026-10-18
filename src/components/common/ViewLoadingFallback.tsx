import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ViewLoadingFallbackProps {
  title?: string;
}

export const ViewLoadingFallback: React.FC<ViewLoadingFallbackProps> = ({
  title = 'Carregando...',
}) => {
  return (
    <div className="space-y-4 animate-pulse py-2">
      {/* Header Skeleton */}
      <div className="h-16 bg-zinc-100 dark:bg-[#141417] rounded-2xl border border-black/[0.04] dark:border-white/[0.04] p-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-3 w-56 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin opacity-80" />
          <span className="text-xs text-zinc-400 font-medium">{title}</span>
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={`skel-card-${idx}`}
            className="h-28 bg-zinc-100 dark:bg-[#141417] rounded-2xl border border-black/[0.04] dark:border-white/[0.04] p-4 space-y-3"
          >
            <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            <div className="h-6 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            <div className="h-2.5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="h-64 bg-zinc-100 dark:bg-[#141417] rounded-2xl border border-black/[0.04] dark:border-white/[0.04] p-6 flex flex-col justify-center items-center gap-3">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        <div className="h-3 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
      </div>
    </div>
  );
};

export default ViewLoadingFallback;
